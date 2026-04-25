import assert from "node:assert/strict"
import test from "node:test"

import { renderLowStockAlertEmail } from "./server/index.js"

test("LowStockAlertEmail renders inventory actions", async () => {
  const rendered = await renderLowStockAlertEmail({
    businessName: "Ink Wave Packaging",
    alertDateLabel: "April 25, 2026 · 4:20 PM",
    inventoryUrl: "https://app.inkwave.local/inventory",
    items: [
      {
        name: "95mm Flat Lid",
        sku: "95-DBBA-FLT",
        currentStock: 0,
        reorderLevel: 300,
        status: "out",
      },
      {
        name: "12oz PET Cup",
        currentStock: 220,
        reorderLevel: 500,
        status: "low",
      },
    ],
  })

  assert.match(rendered.html, /https:\/\/assets\.inkwavebrand\.ing\/iw-logo\.jpg/)
  assert.match(rendered.html, /Low-stock alert/)
  assert.match(rendered.html, /Out of stock/)
  assert.match(rendered.html, /12oz PET Cup/)
  assert.match(rendered.text, /95mm Flat Lid/)
})
