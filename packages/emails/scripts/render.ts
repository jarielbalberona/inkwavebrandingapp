import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import {
  renderDailyBusinessDigestEmail,
  renderLowStockAlertEmail,
} from "../src/server/index.js"

const renderers = {
  DailyBusinessDigestEmail: () =>
    renderDailyBusinessDigestEmail({
      businessName: "Ink Wave Packaging",
      reportDateLabel: "April 25, 2026",
      dashboardUrl: "https://app.inkwave.local/dashboard",
      recipientName: "Rej",
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
        highlightedItems: [
          { name: "12oz PET Cup", onHand: 220, reorderLevel: 500 },
          { name: "95mm Flat Lid", onHand: 0, reorderLevel: 300 },
        ],
      },
      inventoryActivitySummary: {
        stockIntakeCount: 3,
        adjustmentCount: 2,
      },
      highlights: [
        "Follow up on the oldest unpaid invoice before releasing the next order batch.",
        "Move the 16oz PET cup replenishment earlier in the week; current buffer is thin.",
      ],
    }),
  LowStockAlertEmail: () =>
    renderLowStockAlertEmail({
      businessName: "Ink Wave Packaging",
      alertDateLabel: "April 25, 2026 · 4:20 PM",
      inventoryUrl: "https://app.inkwave.local/inventory",
      recipientName: "Rej",
      note: "Restock the lid line before tomorrow morning's production block.",
      items: [
        {
          name: "95mm Flat Lid",
          sku: "95-DBBA-FLT",
          variant: "Clear / Dabba",
          currentStock: 0,
          reorderLevel: 300,
          status: "out",
        },
        {
          name: "12oz PET Cup",
          sku: "12-PET-CLR",
          variant: "Clear PET / 12oz",
          currentStock: 220,
          reorderLevel: 500,
          status: "low",
        },
  ],
    }),
} satisfies Record<string, () => Promise<{ html: string }>>

type TemplateName = keyof typeof renderers

async function main() {
  const templateName = process.argv[2]

  if (!templateName || !(templateName in renderers)) {
    console.error("Usage: pnpm -C packages/emails render <TemplateName>")
    console.error("Available templates:")
    for (const name of Object.keys(renderers)) {
      console.error(`  - ${name}`)
    }
    process.exit(1)
  }

  const rendered = await renderers[templateName as TemplateName]()
  const outputDir = join(process.cwd(), "output")
  mkdirSync(outputDir, { recursive: true })

  const outputPath = join(outputDir, `${templateName}.html`)
  writeFileSync(outputPath, rendered.html, "utf8")

  console.log(`Rendered ${templateName} to ${outputPath}`)
}

void main()
