import assert from "node:assert/strict"
import test from "node:test"

import { EmailProviderError } from "../../lib/email/index.js"

import { DailyDigestRunner } from "./daily-digest-runner.js"

test("DailyDigestRunner skips when no recipients resolve", async () => {
  const updates: unknown[] = []
  const runner = new DailyDigestRunner({
    env: {
      emailProvider: "resend",
      resendApiKey: "test",
      resendFromEmail: "ops@inkwave.test",
      resendReplyToEmail: undefined,
      webOrigin: "https://app.inkwave.test",
    },
    repository: {
      transaction: async (handler: (repository: unknown) => Promise<unknown>) =>
        handler({
          ensureRun: async () => ({ id: "run-1", recipientCount: 0, sentCount: 0, failedCount: 0 }),
          claimRun: async () => ({ id: "run-1" }),
          updateRunCounts: async (_runId: string, input: unknown) => {
            updates.push(input)
            return { id: "run-1" }
          },
        }),
    } as never,
    aggregationService: {
      async build() {
        return {
          window: {
            businessDate: "2026-04-27",
            timezone: "Asia/Manila" as const,
            startedAt: new Date("2026-04-26T16:00:00.000Z"),
            endedAt: new Date("2026-04-27T16:00:00.000Z"),
          },
          props: {
            businessName: "Ink Wave Branding",
            reportDateLabel: "Monday, April 27, 2026",
            dashboardUrl: "https://app.inkwave.test/dashboard",
            orderSummary: {
              totalOrders: 0,
              pendingOrders: 0,
              inProgressOrders: 0,
              partialReleasedOrders: 0,
              completedOrders: 0,
              canceledOrders: 0,
            },
            invoiceSummary: {
              pendingInvoiceCount: 0,
              paidInvoiceCount: 0,
              voidInvoiceCount: 0,
              totalPaidAmount: 0,
              outstandingBalance: 0,
            },
            inventorySummary: {
              lowStockCount: 0,
              outOfStockCount: 0,
              highlightedItems: [],
            },
            inventoryActivitySummary: {
              stockIntakeCount: 0,
              adjustmentCount: 0,
            },
            highlights: [],
          },
          highlights: [],
          isEmpty: false,
        }
      },
    } as never,
    recipientResolver: {
      async resolve() {
        return []
      },
    } as never,
    emailProvider: {
      async sendEmail() {
        throw new Error("should not send")
      },
    },
    now: () => new Date("2026-04-27T09:30:00.000Z"),
  })

  const result = await runner.runForBusinessDate("2026-04-27")

  assert.equal(result.status, "skipped_no_recipients")
  assert.equal(updates.length, 1)
})

test("DailyDigestRunner is rerun-safe for already succeeded runs", async () => {
  const runner = new DailyDigestRunner({
    env: {
      emailProvider: "resend",
      resendApiKey: "test",
      resendFromEmail: "ops@inkwave.test",
      resendReplyToEmail: undefined,
      webOrigin: "https://app.inkwave.test",
    },
    repository: {
      transaction: async (handler: (repository: unknown) => Promise<unknown>) =>
        handler({
          ensureRun: async () => ({ id: "run-1", recipientCount: 2, sentCount: 2, failedCount: 0 }),
          claimRun: async () => undefined,
        }),
    } as never,
    aggregationService: {
      async build() {
        return {
          window: {
            businessDate: "2026-04-27",
            timezone: "Asia/Manila" as const,
            startedAt: new Date("2026-04-26T16:00:00.000Z"),
            endedAt: new Date("2026-04-27T16:00:00.000Z"),
          },
          props: {
            businessName: "Ink Wave Branding",
            reportDateLabel: "Monday, April 27, 2026",
            dashboardUrl: "https://app.inkwave.test/dashboard",
            orderSummary: {
              totalOrders: 1,
              pendingOrders: 1,
              inProgressOrders: 0,
              partialReleasedOrders: 0,
              completedOrders: 0,
              canceledOrders: 0,
            },
            invoiceSummary: {
              pendingInvoiceCount: 0,
              paidInvoiceCount: 0,
              voidInvoiceCount: 0,
              totalPaidAmount: 0,
              outstandingBalance: 0,
            },
            inventorySummary: {
              lowStockCount: 0,
              outOfStockCount: 0,
              highlightedItems: [],
            },
            inventoryActivitySummary: {
              stockIntakeCount: 0,
              adjustmentCount: 0,
            },
            highlights: ["Orders created today: 1"],
          },
          highlights: ["Orders created today: 1"],
          isEmpty: false,
        }
      },
    } as never,
    recipientResolver: {
      async resolve() {
        return [{ email: "admin@inkwave.test" }]
      },
    } as never,
    emailProvider: {
      async sendEmail() {
        throw new Error("should not send")
      },
    },
  })

  const result = await runner.runForBusinessDate("2026-04-27")

  assert.equal(result.status, "already_succeeded")
  assert.equal(result.sentCount, 2)
})

test("DailyDigestRunner records retryable provider failures", async () => {
  const attempts: unknown[] = []
  const runner = new DailyDigestRunner({
    env: {
      emailProvider: "resend",
      resendApiKey: "test",
      resendFromEmail: "ops@inkwave.test",
      resendReplyToEmail: undefined,
      webOrigin: "https://app.inkwave.test",
    },
    repository: {
      transaction: async (handler: (repository: unknown) => Promise<unknown>) =>
        handler({
          ensureRun: async () => ({ id: "run-1", recipientCount: 0, sentCount: 0, failedCount: 0 }),
          claimRun: async () => ({ id: "run-1" }),
          seedDeliveries: async () => [],
          listPendingDeliveries: async () => [
            {
              id: "delivery-1",
              recipientEmail: "admin@inkwave.test",
              recipientName: "Admin",
              attemptCount: 0,
            },
          ],
          markDeliveryFailed: async () => ({ id: "delivery-1" }),
          appendAttempt: async (_deliveryId: string, input: unknown) => {
            attempts.push(input)
          },
          listRunDeliveries: async () => [
            {
              id: "delivery-1",
              status: "failed_retryable",
            },
          ],
          updateRunCounts: async () => ({ id: "run-1" }),
        }),
    } as never,
    aggregationService: {
      async build() {
        return {
          window: {
            businessDate: "2026-04-27",
            timezone: "Asia/Manila" as const,
            startedAt: new Date("2026-04-26T16:00:00.000Z"),
            endedAt: new Date("2026-04-27T16:00:00.000Z"),
          },
          props: {
            businessName: "Ink Wave Branding",
            reportDateLabel: "Monday, April 27, 2026",
            dashboardUrl: "https://app.inkwave.test/dashboard",
            orderSummary: {
              totalOrders: 1,
              pendingOrders: 1,
              inProgressOrders: 0,
              partialReleasedOrders: 0,
              completedOrders: 0,
              canceledOrders: 0,
            },
            invoiceSummary: {
              pendingInvoiceCount: 0,
              paidInvoiceCount: 0,
              voidInvoiceCount: 0,
              totalPaidAmount: 0,
              outstandingBalance: 0,
            },
            inventorySummary: {
              lowStockCount: 0,
              outOfStockCount: 0,
              highlightedItems: [],
            },
            inventoryActivitySummary: {
              stockIntakeCount: 0,
              adjustmentCount: 0,
            },
            highlights: ["Orders created today: 1"],
          },
          highlights: ["Orders created today: 1"],
          isEmpty: false,
        }
      },
    } as never,
    recipientResolver: {
      async resolve() {
        return [{ email: "admin@inkwave.test", name: "Admin" }]
      },
    } as never,
    emailProvider: {
      async sendEmail() {
        throw new EmailProviderError("Rate limit", {
          retryable: true,
          code: "rate_limit",
        })
      },
    },
    now: () => new Date("2026-04-27T09:30:00.000Z"),
  })

  const result = await runner.runForBusinessDate("2026-04-27")

  assert.equal(result.status, "failed")
  assert.equal(attempts.length, 1)
  assert.match(JSON.stringify(attempts[0]), /failed_retryable/)
})
