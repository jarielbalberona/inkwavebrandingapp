import assert from "node:assert/strict"
import test from "node:test"

import { runScheduledDailyDigest } from "./run-scheduled-daily-digest.js"

test("runScheduledDailyDigest skips weekend dates in Manila", async () => {
  let called = false

  const result = await runScheduledDailyDigest({
    runner: {
      async runForBusinessDate() {
        called = true
        return {
          businessDate: "2026-04-25",
          status: "succeeded",
          recipientCount: 1,
          sentCount: 1,
          failedCount: 0,
        }
      },
    },
    now: () => new Date("2026-04-25T09:30:00.000Z"),
  })

  assert.equal(called, false)
  assert.equal(result.status, "skipped_weekend")
  assert.equal(result.businessDate, "2026-04-25")
})

test("runScheduledDailyDigest runs on weekdays using Manila business date", async () => {
  let receivedBusinessDate: string | undefined

  const result = await runScheduledDailyDigest({
    runner: {
      async runForBusinessDate(businessDate) {
        receivedBusinessDate = businessDate ?? "missing"

        return {
          businessDate: businessDate ?? "missing",
          status: "succeeded",
          recipientCount: 2,
          sentCount: 2,
          failedCount: 0,
        }
      },
    },
    now: () => new Date("2026-04-27T09:30:00.000Z"),
  })

  assert.equal(receivedBusinessDate, "2026-04-27")
  assert.equal(result.status, "succeeded")
  assert.equal(result.sentCount, 2)
})
