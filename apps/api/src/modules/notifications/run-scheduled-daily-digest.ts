import { logInfo } from "../../lib/logger.js"
import { DailyDigestRunner, type DailyDigestRunnerResult } from "./daily-digest-runner.js"
import { getManilaBusinessDate, isManilaWeekday } from "./daily-digest-time.js"

export async function runScheduledDailyDigest(input: {
  runner: Pick<DailyDigestRunner, "runForBusinessDate">
  now?: () => Date
}): Promise<
  | DailyDigestRunnerResult
  | {
      businessDate: string
      status: "skipped_weekend"
      recipientCount: 0
      sentCount: 0
      failedCount: 0
    }
> {
  const now = input.now ?? (() => new Date())
  const businessDate = getManilaBusinessDate(now())

  if (!isManilaWeekday(businessDate)) {
    logInfo({
      event: "scheduled_daily_digest_skipped",
      businessDate,
      reason: "weekend",
    })

    return {
      businessDate,
      status: "skipped_weekend",
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
    }
  }

  return input.runner.runForBusinessDate(businessDate)
}

if (isDirectExecution(import.meta.url)) {
  const { getDatabaseClient } = await import("../../db/client.js")
  const { loadApiEnv } = await import("../../config/env.js")
  const { UsersRepository } = await import("../users/users.repository.js")
  const { DailyDigestAggregationRepository } = await import(
    "./daily-digest-aggregation.repository.js"
  )
  const { DailyDigestAggregationService } = await import(
    "./daily-digest-aggregation.service.js"
  )
  const { DailyDigestRecipientResolver } = await import(
    "./daily-digest-recipient-resolver.js"
  )
  const { DailyDigestRepository } = await import("./daily-digest.repository.js")

  const env = loadApiEnv()
  const db = getDatabaseClient()
  const runner = new DailyDigestRunner({
    env,
    repository: new DailyDigestRepository(db),
    aggregationService: new DailyDigestAggregationService(
      new DailyDigestAggregationRepository(db),
    ),
    recipientResolver: new DailyDigestRecipientResolver(new UsersRepository(db)),
  })

  runScheduledDailyDigest({
    runner,
  })
    .then((result) => {
      console.log(JSON.stringify({ event: "scheduled_daily_digest_result", ...result }))
      process.exitCode = result.status === "failed" ? 1 : 0
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: "scheduled_daily_digest_failed",
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : null,
        }),
      )
      process.exitCode = 1
    })
}

function isDirectExecution(moduleUrl: string): boolean {
  const entryPath = process.argv[1]

  if (!entryPath) {
    return false
  }

  return moduleUrl === new URL(`file://${entryPath}`).href
}
