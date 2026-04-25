import assert from "node:assert/strict"
import test from "node:test"

import { renderDailyBusinessDigestEmail } from "./server/index.js"

test("DailyBusinessDigestEmail renders the operational summary", async () => {
  const rendered = await renderDailyBusinessDigestEmail({
    businessName: "Ink Wave Packaging",
    reportDateLabel: "April 25, 2026",
    dashboardUrl: "https://app.inkwave.local/dashboard",
    orderSummary: {
      totalOrders: 48,
      pendingOrders: 11,
      inProgressOrders: 9,
      partialReleasedOrders: 4,
      completedOrders: 18,
      canceledOrders: 6,
    },
    invoiceSummary: {
      pendingInvoiceCount: 8,
      paidInvoiceCount: 16,
      voidInvoiceCount: 1,
      totalPaidAmount: 240000,
      outstandingBalance: 128500,
    },
    inventorySummary: {
      lowStockCount: 4,
      outOfStockCount: 1,
      highlightedItems: [{ name: "95mm Flat Lid", onHand: 0, reorderLevel: 300 }],
    },
    inventoryActivitySummary: {
      stockIntakeCount: 3,
      adjustmentCount: 2,
    },
    highlights: ["Push payment follow-up on the oldest unpaid invoice before release."],
  })

  assert.match(rendered.html, /https:\/\/assets\.inkwavebrand\.ing\/iw-logo\.jpg/)
  assert.match(rendered.html, /Daily business digest/)
  assert.match(rendered.html, /In progress/)
  assert.match(rendered.html, /Partial released/)
  assert.match(rendered.html, /Pending Orders/)
  assert.match(rendered.html, /95mm Flat Lid/)
  assert.match(rendered.html, /Amount collected/)
  assert.match(rendered.html, /Inventory activity/)
  assert.match(rendered.text, /oldest unpaid invoice/)
})

test("DailyBusinessDigestEmail renders sane empty-state content", async () => {
  const rendered = await renderDailyBusinessDigestEmail({
    businessName: "Ink Wave Packaging",
    reportDateLabel: "April 25, 2026",
    dashboardUrl: "https://app.inkwave.local/dashboard",
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
  })

  assert.match(rendered.html, /No highlighted items in this digest/)
  assert.match(rendered.html, /Collected/)
})
