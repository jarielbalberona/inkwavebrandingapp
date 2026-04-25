import { getDatabaseClient } from "../../db/client.js"
import { loadApiEnv } from "../../config/env.js"
import { UsersRepository } from "../users/users.repository.js"

import { DailyDigestAggregationRepository } from "./daily-digest-aggregation.repository.js"
import { DailyDigestAggregationService } from "./daily-digest-aggregation.service.js"
import { DailyDigestRecipientResolver } from "./daily-digest-recipient-resolver.js"
import { DailyDigestRunner } from "./daily-digest-runner.js"
import { getManilaBusinessDate } from "./daily-digest-time.js"
import { DailyDigestRepository } from "./daily-digest.repository.js"

const args = process.argv.slice(2)
const env = loadApiEnv()
const db = getDatabaseClient()
const businessDate = parseBusinessDateArg(args) ?? getManilaBusinessDate()
const debug = parseDebugFlag(args)
const forceResend = parseForceResendFlag(args)

if (debug) {
  const fromEmail = env.resendFromEmail ?? null
  const fromEmailHint =
    fromEmail && /^".*"$/.test(fromEmail.trim())
      ? "RESEND_FROM_EMAIL appears to include extra double quotes; use Ink Wave Name <addr@domain> without surrounding quotes in Render."
      : null
  console.log(
    JSON.stringify({
      event: "daily_digest_cli_debug_preflight",
      businessDate,
      logLevel: process.env.LOG_LEVEL ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
      emailProvider: env.emailProvider,
      resendApiKeyConfigured: Boolean(env.resendApiKey),
      resendFromEmail: fromEmail,
      resendFromEmailHint: fromEmailHint,
      webOrigin: env.webOrigin ?? null,
      forceResend,
    }),
  )
}

const runner = new DailyDigestRunner({
  env,
  repository: new DailyDigestRepository(db),
  aggregationService: new DailyDigestAggregationService(
    new DailyDigestAggregationRepository(db),
  ),
  recipientResolver: new DailyDigestRecipientResolver(new UsersRepository(db)),
})

runner
  .runForBusinessDate(businessDate, { includeFailureDetails: debug, forceResend })
  .then((result) => {
    console.log(
      JSON.stringify({
        event: "daily_digest_cli_result",
        ...result,
        ...(debug ? { debug: true } : {}),
      }),
    )
    process.exitCode = result.status === "failed" ? 1 : 0
  })
  .catch((error) => {
    console.error(
      JSON.stringify({
        event: "daily_digest_cli_failed",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : null,
      }),
    )
    process.exitCode = 1
  })

function parseBusinessDateArg(args: string[]): string | undefined {
  for (const arg of args) {
    if (arg.startsWith("--business-date=")) {
      return arg.slice("--business-date=".length)
    }
  }

  return undefined
}

function parseDebugFlag(args: string[]): boolean {
  if (args.includes("--debug") || process.env.DAILY_DIGEST_DEBUG === "1") {
    return true
  }

  return false
}

function parseForceResendFlag(args: string[]): boolean {
  if (args.includes("--force-resend") || process.env.DAILY_DIGEST_FORCE_RESEND === "1") {
    return true
  }

  return false
}
