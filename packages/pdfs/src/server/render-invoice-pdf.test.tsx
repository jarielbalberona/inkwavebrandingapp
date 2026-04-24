import test from "node:test"
import assert from "node:assert/strict"

import { renderInvoicePdf } from "./render-invoice-pdf.js"

test("renderInvoicePdf returns a PDF buffer for invoice data", async () => {
  const pdf = await renderInvoicePdf({
    invoice_number: "INV-20260424-ABCDEFGH",
    order_number_snapshot: "ORD-001",
    subtotal: "2400.00",
    created_at: "2026-04-24T00:00:00.000Z",
    customer: {
      customer_code: "CUST-001",
      business_name: "Ink Wave Cafe",
      contact_person: "Jane Doe",
      contact_number: "09170000000",
      email: "jane@example.com",
      address: "Manila",
    },
    items: [
      {
        id: "item-1",
        item_type: "cup",
        description_snapshot: "12oz kraft paper cup",
        quantity: 100,
        unit_price: "15.00",
        line_total: "1500.00",
      },
      {
        id: "item-2",
        item_type: "lid",
        description_snapshot: "80mm coffee lid",
        quantity: 180,
        unit_price: "5.00",
        line_total: "900.00",
      },
    ],
  })

  assert.ok(Buffer.isBuffer(pdf))
  assert.ok(pdf.byteLength > 0)
  assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF")
})

test("renderInvoicePdf supports custom_charge invoice lines", async () => {
  const pdf = await renderInvoicePdf({
    invoice_number: "INV-20260424-CUSTOM01",
    order_number_snapshot: "ORD-002",
    subtotal: "500.00",
    created_at: "2026-04-24T00:00:00.000Z",
    customer: {
      customer_code: "CUST-001",
      business_name: "Ink Wave Cafe",
      contact_person: "Jane Doe",
      contact_number: "09170000000",
      email: "jane@example.com",
      address: "Manila",
    },
    items: [
      {
        id: "item-1",
        item_type: "custom_charge",
        description_snapshot: "Rush fee",
        quantity: 1,
        unit_price: "500.00",
        line_total: "500.00",
      },
    ],
  })

  assert.ok(Buffer.isBuffer(pdf))
  assert.ok(pdf.byteLength > 0)
  assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF")
})
