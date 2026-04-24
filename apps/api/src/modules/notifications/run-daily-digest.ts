import { getDatabaseClient } from "../../db/client.js"
import { loadApiEnv } from "../../config/env.js"
import { UsersRepository } from "../users/users.repository.js"

import { DailyDigestAggregationRepository } from "./daily-digest-aggregation.repository.js"
import { DailyDigestAggregationService } from "./daily-digest-aggregation.service.js"
import { DailyDigestRecipientResolver } from "./daily-digest-recipient-resolver.js"
import { DailyDigestRunner } from "./daily-digest-runner.js"
import { getManilaBusinessDate } from "./daily-digest-time.js"
import { DailyDigestRepository } from "./daily-digest.repository.js"

const env = loadApiEnv()
const db = getDatabaseClient()
const businessDate = parseBusinessDateArg(process.argv.slice(2)) ?? getManilaBusinessDate()

const runner = new DailyDigestRunner({
  env,
  repository: new DailyDigestRepository(db),
  aggregationService: new DailyDigestAggregationService(
    new DailyDigestAggregationRepository(db),
  ),
  recipientResolver: new DailyDigestRecipientResolver(new UsersRepository(db)),
})

runner
  .runForBusinessDate(businessDate)
  .then((result) => {
    console.log(JSON.stringify({ event: "daily_digest_cli_result", ...result }))
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
