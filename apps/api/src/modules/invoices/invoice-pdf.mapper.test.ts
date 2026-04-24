import assert from "node:assert/strict"
import test from "node:test"

import { toInvoicePdfData } from "./invoice-pdf.mapper.js"
import type { InvoiceDto } from "./invoices.types.js"

test("toInvoicePdfData uses persisted payment rollups for partially paid invoices", () => {
  const invoice = buildInvoiceDto({
    status: "pending",
    total_amount: "2400.00",
    paid_amount: "750.00",
    remaining_balance: "1650.00",
  })

  const pdfData = toInvoicePdfData(invoice)

  assert.equal(pdfData.status.label, "Pending")
  assert.equal(pdfData.status.tone, "warning")
  assert.equal(pdfData.total, "2400.00")
  assert.equal(pdfData.paid_amount, "750.00")
  assert.equal(pdfData.remaining_balance, "1650.00")
})

test("toInvoicePdfData preserves paid invoice rollups from persisted state", () => {
  const invoice = buildInvoiceDto({
    status: "paid",
    total_amount: "2400.00",
    paid_amount: "2400.00",
    remaining_balance: "0.00",
  })

  const pdfData = toInvoicePdfData(invoice)

  assert.equal(pdfData.status.label, "Paid")
  assert.equal(pdfData.status.tone, "success")
  assert.equal(pdfData.total, "2400.00")
  assert.equal(pdfData.paid_amount, "2400.00")
  assert.equal(pdfData.remaining_balance, "0.00")
})

function buildInvoiceDto(overrides: Partial<InvoiceDto> = {}): InvoiceDto {
  return {
    id: "invoice-1",
    invoice_number: "INV-20260424-TEST0001",
    order_id: "order-1",
    order_number_snapshot: "ORD-001",
    customer: {
      id: "customer-1",
      customer_code: "CUST-001",
      business_name: "Ink Wave Cafe",
      contact_person: "Jane Doe",
      contact_number: "09170000000",
      email: "jane@example.com",
      address: "Manila",
    },
    status: "pending",
    subtotal: "2400.00",
    total_amount: "2400.00",
    paid_amount: "0.00",
    remaining_balance: "2400.00",
    due_date: null,
    notes: null,
    items: [
      {
        id: "item-1",
        order_line_item_id: "order-item-1",
        item_type: "cup",
        description_snapshot: "12oz kraft paper cup",
        quantity: 100,
        unit_price: "24.00",
        line_total: "2400.00",
        created_at: "2026-04-24T09:00:00.000Z",
      },
    ],
    payments: [],
    created_at: "2026-04-24T09:00:00.000Z",
    updated_at: "2026-04-24T09:00:00.000Z",
    ...overrides,
  }
}
