import assert from "node:assert/strict"
import test from "node:test"

import { AuthorizationError } from "../auth/authorization.js"
import { ReportsService } from "./reports.service.js"

const adminUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin" as const,
  permissions: [],
}

const staffUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "staff@example.com",
  displayName: "Staff",
  role: "staff" as const,
  permissions: ["reports.view"],
}

test("ReportsService.getCommercialSalesReport exposes product bundle revenue from invoice snapshots", async () => {
  const service = new ReportsService({
    listCommercialSales: async () => [
      {
        itemType: "product_bundle",
        itemId: "33333333-3333-4333-8333-333333333333",
        descriptionSnapshot: "16oz PET Cup + Flat Lid",
        quantitySold: 1000,
        revenue: "8500.00",
        averageUnitPrice: "8.50",
        invoiceCount: 1,
        orderCount: 1,
      },
      {
        itemType: "custom_charge",
        itemId: null,
        descriptionSnapshot: "Rush fee",
        quantitySold: 1,
        revenue: "500.00",
        averageUnitPrice: "500.00",
        invoiceCount: 1,
        orderCount: 1,
      },
    ],
    countCommercialSalesRepresented: async () => ({
      invoiceCount: 1,
      orderCount: 1,
    }),
  } as never)

  const report = await service.getCommercialSalesReport({}, adminUser)

  assert.equal(report.revenue_basis, "invoice_line_snapshots")
  assert.equal(report.items[0]?.item_type, "product_bundle")
  assert.equal(report.items[0]?.description_snapshot, "16oz PET Cup + Flat Lid")
  assert.equal(report.items[0]?.revenue, "8500.00")
  assert.equal(report.items[1]?.item_type, "custom_charge")
  assert.equal(report.totals.total_revenue, "9000.00")
  assert.equal(report.totals.total_quantity, 1001)
  assert.equal(report.totals.total_invoices, 1)
  assert.equal(report.totals.total_orders, 1)
})

test("ReportsService.getCommercialSalesReport rejects staff without financial-report permission", async () => {
  const service = new ReportsService({
    listCommercialSales: async () => {
      throw new Error("commercial query should not run")
    },
    countCommercialSalesRepresented: async () => {
      throw new Error("commercial count should not run")
    },
  } as never)

  await assert.rejects(
    () => service.getCommercialSalesReport({}, staffUser),
    AuthorizationError,
  )
})

test("ReportsService.getCupUsageReport remains ledger/component based", async () => {
  let commercialSalesQueried = false
  const service = new ReportsService({
    listCupUsage: async () => [
      {
        cup: {
          id: "44444444-4444-4444-8444-444444444444",
          sku: "CUP-16",
          type: "plastic",
          brand: "Dabba",
          diameter: "95mm",
          size: "16oz",
          color: "transparent",
          is_active: true,
        },
        consumedQuantity: 1000,
      },
    ],
    listCommercialSales: async () => {
      commercialSalesQueried = true
      return []
    },
  } as never)

  const report = await service.getCupUsageReport({}, adminUser)

  assert.equal(commercialSalesQueried, false)
  assert.equal(report.total_consumed_quantity, 1000)
  assert.equal(report.items[0]?.cup.sku, "CUP-16")
})
