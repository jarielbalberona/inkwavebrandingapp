import type { ApiEnv } from "../../config/env.js"
import { EmailProviderError, type EmailProvider } from "../../lib/email/index.js"
import { buildDailyBusinessDigestMessage, ResendEmailProvider } from "../../lib/email/index.js"
import { logError, logInfo, serializeError } from "../../lib/logger.js"

import type {
  DailyDigestBuildResult,
  DailyDigestAggregationService,
} from "./daily-digest-aggregation.service.js"
import {
  DailyDigestRecipientResolver,
  type DailyDigestRecipient,
} from "./daily-digest-recipient-resolver.js"
import { getManilaBusinessDate } from "./daily-digest-time.js"
import type { DailyDigestRepository } from "./daily-digest.repository.js"

export interface DailyDigestDeliveryFailureDetail {
  recipientEmail: string
  errorCode: string | null
  errorMessage: string
  retryable: boolean
}

export interface DailyDigestRunOptions {
  /**
   * When set, the result includes `deliveryFailures` (use with daily digest CLI `--debug`).
   * Includes errors from send attempts in this run, and for re-runs with no pending deliveries
   * (e.g. `failed_terminal`) backfills `last_error_*` from stored delivery rows.
   */
  includeFailureDetails?: boolean
}

export interface DailyDigestRunnerResult {
  businessDate: string
  runId?: string
  status:
    | "already_succeeded"
    | "failed"
    | "partial_failure"
    | "skipped_empty"
    | "skipped_no_recipients"
    | "succeeded"
  recipientCount: number
  sentCount: number
  failedCount: number
  /** Populated when `includeFailureDetails` is true and at least one send attempt failed */
  deliveryFailures?: DailyDigestDeliveryFailureDetail[]
}

interface DailyDigestRunnerDependencies {
  env: Pick<ApiEnv, "emailProvider" | "resendApiKey" | "resendFromEmail" | "resendReplyToEmail" | "webOrigin">
  repository: DailyDigestRepository
  aggregationService: DailyDigestAggregationService
  recipientResolver: DailyDigestRecipientResolver
  emailProvider?: EmailProvider
  now?: () => Date
}

export class DailyDigestRunner {
  private readonly emailProvider: EmailProvider
  private readonly now: () => Date

  constructor(private readonly deps: DailyDigestRunnerDependencies) {
    this.emailProvider = deps.emailProvider ?? createEmailProvider(deps.env)
    this.now = deps.now ?? (() => new Date())
  }

  async runForBusinessDate(
    businessDate: string = getManilaBusinessDate(this.now()),
    runOptions: DailyDigestRunOptions = {},
  ): Promise<DailyDigestRunnerResult> {
    const { includeFailureDetails = false } = runOptions
    const digest = await this.deps.aggregationService.build({
      businessDate,
      dashboardUrl: resolveDashboardUrl(this.deps.env.webOrigin),
    })

    return this.deps.repository.transaction(async (repository) => {
      const run = await repository.ensureRun({
        businessDate: digest.window.businessDate,
        timezone: digest.window.timezone,
        startedAt: digest.window.startedAt,
        endedAt: digest.window.endedAt,
      })
      const claimedRun = await repository.claimRun(run.id, this.now())

      if (!claimedRun) {
        logInfo({
          event: "daily_digest_run_skipped",
          businessDate,
          reason: "run_not_claimable",
          runId: run.id,
        })

        return {
          businessDate,
          runId: run.id,
          status: "already_succeeded",
          recipientCount: run.recipientCount,
          sentCount: run.sentCount,
          failedCount: run.failedCount,
        }
      }

      const recipients = await this.deps.recipientResolver.resolve()

      if (recipients.length === 0) {
        const updatedRun = await repository.updateRunCounts(claimedRun.id, {
          recipientCount: 0,
          sentCount: 0,
          failedCount: 0,
          status: "skipped_no_recipients",
          completedAt: this.now(),
          lastErrorCode: "no_recipients",
          lastErrorMessage: "No active admin recipients were resolved for the daily digest.",
        })

        logInfo({
          event: "daily_digest_run_skipped",
          businessDate,
          reason: "no_recipients",
          runId: updatedRun.id,
        })

        return {
          businessDate,
          runId: updatedRun.id,
          status: "skipped_no_recipients",
          recipientCount: 0,
          sentCount: 0,
          failedCount: 0,
        }
      }

      if (digest.isEmpty) {
        const updatedRun = await repository.updateRunCounts(claimedRun.id, {
          recipientCount: recipients.length,
          sentCount: 0,
          failedCount: 0,
          status: "skipped_empty",
          completedAt: this.now(),
          lastErrorCode: "empty_digest",
          lastErrorMessage: "Daily digest contained no meaningful content for the business day.",
        })

        logInfo({
          event: "daily_digest_run_skipped",
          businessDate,
          reason: "empty_digest",
          runId: updatedRun.id,
        })

        return {
          businessDate,
          runId: updatedRun.id,
          status: "skipped_empty",
          recipientCount: recipients.length,
          sentCount: 0,
          failedCount: 0,
        }
      }

      await repository.seedDeliveries(
        claimedRun.id,
        recipients.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
        })),
      )

      const pendingDeliveries = await repository.listPendingDeliveries(claimedRun.id)
      const failureDetails = includeFailureDetails ? [] as DailyDigestDeliveryFailureDetail[] : undefined

      for (const delivery of pendingDeliveries) {
        await this.deliverRecipient(repository, delivery, digest, failureDetails)
      }

      const deliveries = await repository.listRunDeliveries(claimedRun.id)
      const sentCount = deliveries.filter((delivery) => delivery.status === "sent").length
      const failedCount = deliveries.filter((delivery) => delivery.status !== "sent").length
      const nextStatus =
        failedCount === 0
          ? "succeeded"
          : sentCount > 0
            ? "partial_failure"
            : "failed"

      const deliveryFailureDiagnostics =
        includeFailureDetails
          ? mergeFailureDetailsFromStoredDeliveries(failureDetails, deliveries)
          : undefined

      const updatedRun = await repository.updateRunCounts(claimedRun.id, {
        recipientCount: deliveries.length,
        sentCount,
        failedCount,
        status: nextStatus,
        completedAt: this.now(),
        lastErrorCode: nextStatus === "succeeded" ? null : "delivery_failures",
        lastErrorMessage:
          nextStatus === "succeeded"
            ? null
            : "One or more daily digest deliveries failed. Inspect delivery attempts for details.",
      })

      logInfo({
        event: "daily_digest_run_completed",
        businessDate,
        runId: updatedRun.id,
        status: nextStatus,
        recipientCount: deliveries.length,
        sentCount,
        failedCount,
      })

      return {
        businessDate,
        runId: updatedRun.id,
        status: nextStatus,
        recipientCount: deliveries.length,
        sentCount,
        failedCount,
        ...(deliveryFailureDiagnostics && deliveryFailureDiagnostics.length > 0
          ? { deliveryFailures: deliveryFailureDiagnostics }
          : {}),
      }
    })
  }

  private async deliverRecipient(
    repository: DailyDigestRepository,
    delivery: Awaited<ReturnType<DailyDigestRepository["listPendingDeliveries"]>>[number],
    digest: DailyDigestBuildResult,
    failureDetails?: DailyDigestDeliveryFailureDetail[],
  ) {
    const attemptedAt = this.now()
    const attemptNumber = delivery.attemptCount + 1
    const message = await buildDailyBusinessDigestMessage({
      ...digest.props,
      recipientName: delivery.recipientName ?? undefined,
    })

    try {
      const result = await this.emailProvider.sendEmail({
        to: delivery.recipientEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
      })

      await repository.markDeliverySent(delivery.id, {
        provider: result.provider,
        providerMessageId: result.id,
        attemptedAt,
      })
      await repository.appendAttempt(delivery.id, {
        attemptNumber,
        status: "sent",
        provider: result.provider,
        providerMessageId: result.id,
        attemptedAt,
      })
    } catch (error) {
      const providerError = normalizeDeliveryError(error)

      if (failureDetails) {
        failureDetails.push({
          recipientEmail: delivery.recipientEmail,
          errorCode: providerError.code ?? null,
          errorMessage: providerError.message,
          retryable: providerError.retryable,
        })
      }

      await repository.markDeliveryFailed(delivery.id, {
        retryable: providerError.retryable,
        errorCode: providerError.code,
        errorMessage: providerError.message,
        attemptedAt,
      })
      await repository.appendAttempt(delivery.id, {
        attemptNumber,
        status: providerError.retryable ? "failed_retryable" : "failed_terminal",
        provider: "resend",
        errorCode: providerError.code,
        errorMessage: providerError.message,
        attemptedAt,
      })

      logError({
        event: "daily_digest_delivery_failed",
        businessDate: digest.window.businessDate,
        recipientEmail: delivery.recipientEmail,
        retryable: providerError.retryable,
        errorCode: providerError.code ?? null,
        ...serializeError(providerError),
      })
    }
  }
}

function createEmailProvider(
  env: Pick<ApiEnv, "emailProvider" | "resendApiKey" | "resendFromEmail" | "resendReplyToEmail">,
): EmailProvider {
  if (env.emailProvider !== "resend") {
    throw new Error(
      "Daily digest runner requires EMAIL_PROVIDER=resend. EMAIL_PROVIDER=none cannot send scheduled digests.",
    )
  }

  return new ResendEmailProvider(env)
}

function resolveDashboardUrl(webOrigin: string | undefined): string {
  if (!webOrigin) {
    throw new Error("WEB_ORIGIN is required to build daily digest dashboard links.")
  }

  return new URL("/dashboard", webOrigin).toString()
}

type RunDeliveryRow = Awaited<ReturnType<DailyDigestRepository["listRunDeliveries"]>>[number]

/**
 * Terminal / non-retryable failures are not listed as "pending", so a re-run may perform no
 * sends. Merge in-memory errors from this run with persisted row data for non-sent deliveries.
 */
function mergeFailureDetailsFromStoredDeliveries(
  fromLoop: DailyDigestDeliveryFailureDetail[] | undefined,
  deliveries: RunDeliveryRow[],
): DailyDigestDeliveryFailureDetail[] {
  const fromLoopByEmail = new Map(
    (fromLoop ?? []).map((f) => [f.recipientEmail.toLowerCase(), f]),
  )
  const out: DailyDigestDeliveryFailureDetail[] = []

  for (const d of deliveries) {
    if (d.status === "sent") {
      continue
    }

    const email = d.recipientEmail
    if (!email) {
      out.push({
        recipientEmail: "(unknown recipient)",
        errorCode: d.lastErrorCode,
        errorMessage:
          d.lastErrorMessage ??
          "Delivery row is missing recipient_email (data integrity issue).",
        retryable: d.status === "failed_retryable",
      })
      continue
    }

    const key = email.toLowerCase()
    const fromAttempt = fromLoopByEmail.get(key)
    if (fromAttempt) {
      out.push(fromAttempt)
      continue
    }

    out.push({
      recipientEmail: email,
      errorCode: d.lastErrorCode,
      errorMessage:
        d.lastErrorMessage ??
        (d.status === "pending"
          ? "Delivery is still pending (no send attempt in this run)."
          : "No error message stored on the delivery row."),
      retryable: d.status === "failed_retryable",
    })
  }

  return out
}

function normalizeDeliveryError(error: unknown): EmailProviderError {
  if (error instanceof EmailProviderError) {
    return error
  }

  if (error instanceof Error) {
    return new EmailProviderError(error.message, {
      retryable: false,
      code: error.name,
      cause: error,
    })
  }

  return new EmailProviderError("Unknown daily digest delivery error", {
    retryable: false,
    code: "unknown_error",
    cause: error,
  })
}
