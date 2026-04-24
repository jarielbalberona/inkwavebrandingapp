import assert from "node:assert/strict"
import test from "node:test"

import { DailyDigestAggregationService } from "./daily-digest-aggregation.service.js"

test("DailyDigestAggregationService builds digest props for a Manila business day", async () => {
  const service = new DailyDigestAggregationService({
    async getOrderStatusCounts() {
      return {
        pending: 2,
        inProgress: 1,
        partialReleased: 1,
        completed: 3,
        canceled: 1,
      }
    },
    async getInvoiceSnapshot() {
      return {
        pendingCount: 2,
        paidCount: 4,
        voidCount: 1,
        outstandingBalance: 1500,
      }
    },
    async getActivityCounts() {
      return {
        ordersCreated: 2,
        ordersUpdated: 5,
        invoicesCreated: 1,
        invoicesVoided: 1,
        paymentsRecorded: 2,
        totalPaidAmount: 2750,
        stockIntakeCount: 1,
        adjustmentCount: 2,
      }
    },
    async listLowStockItems() {
      return [
        {
          name: "CUP-001 · 12oz 90mm",
          onHand: 0,
          reorderLevel: 10,
          status: "out" as const,
        },
      ]
    },
  })

  const digest = await service.build({
    businessDate: "2026-04-27",
    dashboardUrl: "https://app.inkwave.local/dashboard",
  })

  assert.equal(digest.window.timezone, "Asia/Manila")
  assert.equal(digest.props.reportDateLabel, "Monday, April 27, 2026")
  assert.equal(digest.props.orderSummary.totalOrders, 8)
  assert.equal(digest.props.invoiceSummary.totalPaidAmount, 2750)
  assert.equal(digest.props.inventorySummary.outOfStockCount, 1)
  assert.equal(digest.isEmpty, false)
  assert.match(digest.highlights.join(" | "), /Orders created today: 2/)
  assert.match(digest.highlights.join(" | "), /Payments recorded today: 2 totaling 2750.00/)
})

test("DailyDigestAggregationService can report an empty digest", async () => {
  const service = new DailyDigestAggregationService({
    async getOrderStatusCounts() {
      return {
        pending: 0,
        inProgress: 0,
        partialReleased: 0,
        completed: 0,
        canceled: 0,
      }
    },
    async getInvoiceSnapshot() {
      return {
        pendingCount: 0,
        paidCount: 0,
        voidCount: 0,
        outstandingBalance: 0,
      }
    },
    async getActivityCounts() {
      return {
        ordersCreated: 0,
        ordersUpdated: 0,
        invoicesCreated: 0,
        invoicesVoided: 0,
        paymentsRecorded: 0,
        totalPaidAmount: 0,
        stockIntakeCount: 0,
        adjustmentCount: 0,
      }
    },
    async listLowStockItems() {
      return []
    },
  })

  const digest = await service.build({
    businessDate: "2026-04-28",
    dashboardUrl: "https://app.inkwave.local/dashboard",
  })

  assert.equal(digest.isEmpty, true)
  assert.deepEqual(digest.highlights, [])
})
