import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  notificationDigestDeliveries,
  notificationDigestDeliveryAttempts,
  notificationDigestRuns,
  type NotificationDigestDelivery,
  type NotificationDigestDeliveryStatus,
  type NotificationDigestRun,
  type NotificationDigestRunStatus,
} from "../../db/schema/index.js"

export interface DailyDigestWindow {
  businessDate: string
  timezone: string
  startedAt: Date
  endedAt: Date
}

export interface DailyDigestRecipientSeed {
  email: string
  name?: string
}

export interface DailyDigestDeliveryWithAttempts extends NotificationDigestDelivery {
  attempts: typeof notificationDigestDeliveryAttempts.$inferSelect[]
}

const claimableRunStatuses: NotificationDigestRunStatus[] = [
  "pending",
  "failed",
  "partial_failure",
  "skipped_no_recipients",
  "skipped_empty",
]

/** Run states that are not claimable until reopened (used for explicit manual resend). */
const reopenableForResendStatuses: NotificationDigestRunStatus[] = [
  "succeeded",
  "partial_failure",
  "sending",
]

const retryableDeliveryStatuses: NotificationDigestDeliveryStatus[] = [
  "pending",
  "failed_retryable",
]

export class DailyDigestRepository {
  constructor(private readonly db: DatabaseClient) {}

  async transaction<T>(handler: (repository: DailyDigestRepository) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => handler(new DailyDigestRepository(tx as DatabaseClient)))
  }

  async ensureRun(window: DailyDigestWindow): Promise<NotificationDigestRun> {
    const rows = await this.db
      .insert(notificationDigestRuns)
      .values({
        digestType: "daily_business_digest",
        businessDate: window.businessDate,
        timezone: window.timezone,
        status: "pending",
        windowStartedAt: window.startedAt,
        windowEndedAt: window.endedAt,
      })
      .onConflictDoNothing()
      .returning()

    if (rows[0]) {
      return rows[0]
    }

    const existing = await this.findRunByBusinessDate(window.businessDate)

    if (!existing) {
      throw new Error(`Failed to load daily digest run for ${window.businessDate}`)
    }

    return existing
  }

  async findRunByBusinessDate(businessDate: string): Promise<NotificationDigestRun | undefined> {
    const rows = await this.db
      .select()
      .from(notificationDigestRuns)
      .where(
        and(
          eq(notificationDigestRuns.digestType, "daily_business_digest"),
          eq(notificationDigestRuns.businessDate, businessDate),
        ),
      )
      .limit(1)

    return rows[0]
  }

  /**
   * Reset a run that has already completed sending (or is stuck in `sending`) so `claimRun` can
   * process it again. Does not run for `failed` / skipped runs — those are already claimable.
   * Requeues all deliveries to `pending` but keeps `attemptCount` so new attempts append in order.
   */
  async reopenCompletedRunForResend(runId: string, now: Date): Promise<boolean> {
    const rows = await this.db
      .update(notificationDigestRuns)
      .set({
        status: "pending",
        recipientCount: 0,
        sentCount: 0,
        failedCount: 0,
        completedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(notificationDigestRuns.id, runId),
          inArray(notificationDigestRuns.status, reopenableForResendStatuses),
        ),
      )
      .returning({ id: notificationDigestRuns.id })

    if (rows.length === 0) {
      return false
    }

    await this.db
      .update(notificationDigestDeliveries)
      .set({
        status: "pending",
        provider: null,
        providerMessageId: null,
        deliveredAt: null,
        lastAttemptAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: now,
      })
      .where(eq(notificationDigestDeliveries.runId, runId))

    return true
  }

  async claimRun(runId: string, now: Date): Promise<NotificationDigestRun | undefined> {
    const rows = await this.db
      .update(notificationDigestRuns)
      .set({
        status: "sending",
        startedAt: now,
        updatedAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
      })
      .where(
        and(
          eq(notificationDigestRuns.id, runId),
          inArray(notificationDigestRuns.status, claimableRunStatuses),
        ),
      )
      .returning()

    return rows[0]
  }

  async updateRunCounts(
    runId: string,
    input: {
      recipientCount: number
      sentCount: number
      failedCount: number
      status: NotificationDigestRunStatus
      completedAt?: Date | null
      lastErrorCode?: string | null
      lastErrorMessage?: string | null
    },
  ): Promise<NotificationDigestRun> {
    const rows = await this.db
      .update(notificationDigestRuns)
      .set({
        recipientCount: input.recipientCount,
        sentCount: input.sentCount,
        failedCount: input.failedCount,
        status: input.status,
        completedAt: input.completedAt ?? null,
        lastErrorCode: input.lastErrorCode ?? null,
        lastErrorMessage: input.lastErrorMessage ?? null,
        updatedAt: input.completedAt ?? new Date(),
      })
      .where(eq(notificationDigestRuns.id, runId))
      .returning()

    const run = rows[0]

    if (!run) {
      throw new Error(`Failed to update daily digest run ${runId}`)
    }

    return run
  }

  async seedDeliveries(
    runId: string,
    recipients: DailyDigestRecipientSeed[],
  ): Promise<NotificationDigestDelivery[]> {
    if (recipients.length === 0) {
      return []
    }

    const inserted = await this.db
      .insert(notificationDigestDeliveries)
      .values(
        recipients.map((recipient) => ({
          runId,
          recipientEmail: recipient.email.toLowerCase(),
          recipientName: recipient.name?.trim() || null,
          status: "pending" as const,
        })),
      )
      .onConflictDoNothing()
      .returning()

    if (inserted.length === recipients.length) {
      return inserted
    }

    return this.listRunDeliveries(runId)
  }

  async listRunDeliveries(runId: string): Promise<NotificationDigestDelivery[]> {
    return this.db
      .select()
      .from(notificationDigestDeliveries)
      .where(eq(notificationDigestDeliveries.runId, runId))
      .orderBy(asc(notificationDigestDeliveries.recipientEmail))
  }

  async listPendingDeliveries(runId: string): Promise<NotificationDigestDelivery[]> {
    return this.db
      .select()
      .from(notificationDigestDeliveries)
      .where(
        and(
          eq(notificationDigestDeliveries.runId, runId),
          inArray(notificationDigestDeliveries.status, retryableDeliveryStatuses),
        ),
      )
      .orderBy(asc(notificationDigestDeliveries.recipientEmail))
  }

  async markDeliverySent(
    deliveryId: string,
    input: {
      provider: string
      providerMessageId?: string
      attemptedAt: Date
    },
  ): Promise<NotificationDigestDelivery> {
    const rows = await this.db
      .update(notificationDigestDeliveries)
      .set({
        status: "sent",
        provider: input.provider,
        providerMessageId: input.providerMessageId ?? null,
        deliveredAt: input.attemptedAt,
        lastAttemptAt: input.attemptedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
        attemptCount: sql`${notificationDigestDeliveries.attemptCount} + 1`,
        updatedAt: input.attemptedAt,
      })
      .where(eq(notificationDigestDeliveries.id, deliveryId))
      .returning()

    const delivery = rows[0]

    if (!delivery) {
      throw new Error(`Failed to mark digest delivery ${deliveryId} as sent`)
    }

    return delivery
  }

  async markDeliveryFailed(
    deliveryId: string,
    input: {
      retryable: boolean
      errorCode?: string
      errorMessage: string
      attemptedAt: Date
    },
  ): Promise<NotificationDigestDelivery> {
    const rows = await this.db
      .update(notificationDigestDeliveries)
      .set({
        status: input.retryable ? "failed_retryable" : "failed_terminal",
        lastAttemptAt: input.attemptedAt,
        lastErrorCode: input.errorCode ?? null,
        lastErrorMessage: input.errorMessage,
        attemptCount: sql`${notificationDigestDeliveries.attemptCount} + 1`,
        updatedAt: input.attemptedAt,
      })
      .where(eq(notificationDigestDeliveries.id, deliveryId))
      .returning()

    const delivery = rows[0]

    if (!delivery) {
      throw new Error(`Failed to mark digest delivery ${deliveryId} as failed`)
    }

    return delivery
  }

  async appendAttempt(
    deliveryId: string,
    input: {
      attemptNumber: number
      status: typeof notificationDigestDeliveryAttempts.$inferInsert.status
      provider?: string
      providerMessageId?: string
      errorCode?: string
      errorMessage?: string
      attemptedAt: Date
    },
  ) {
    const rows = await this.db
      .insert(notificationDigestDeliveryAttempts)
      .values({
        deliveryId,
        attemptNumber: input.attemptNumber,
        status: input.status,
        provider: input.provider ?? null,
        providerMessageId: input.providerMessageId ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        attemptedAt: input.attemptedAt,
      })
      .returning()

    const attempt = rows[0]

    if (!attempt) {
      throw new Error(`Failed to append digest delivery attempt for ${deliveryId}`)
    }

    return attempt
  }

  async getDeliveryWithAttempts(
    deliveryId: string,
  ): Promise<DailyDigestDeliveryWithAttempts | undefined> {
    const deliveries = await this.db
      .select()
      .from(notificationDigestDeliveries)
      .where(eq(notificationDigestDeliveries.id, deliveryId))
      .limit(1)

    const delivery = deliveries[0]

    if (!delivery) {
      return undefined
    }

    const attempts = await this.db
      .select()
      .from(notificationDigestDeliveryAttempts)
      .where(eq(notificationDigestDeliveryAttempts.deliveryId, deliveryId))
      .orderBy(desc(notificationDigestDeliveryAttempts.attemptNumber))

    return {
      ...delivery,
      attempts,
    }
  }
}
