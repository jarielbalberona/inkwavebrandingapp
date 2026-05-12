import test from "node:test"
import assert from "node:assert/strict"

import { renderInvoicePdf } from "./render-invoice-pdf.js"

function countPdfPages(pdf: Buffer) {
  return pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0
}

test("renderInvoicePdf returns a PDF buffer for invoice data", async () => {
  const pdf = await renderInvoicePdf({
    brand_name: "Ink Wave Branding App",
    document_title: "Invoice",
    invoice_number: "INV-20260424-ABCDEFGH",
    order_reference: "ORD-001",
    generated_at: "Apr 24, 2026",
    status: {
      label: "Pending",
      tone: "warning",
    },
    from: {
      label: "From",
      name: "Ink Wave Branding App",
      lines: ["Cup printing operations"],
    },
    to: {
      label: "To",
      name: "Ink Wave Cafe",
      lines: ["Jane Doe", "09170000000", "jane@example.com", "Manila"],
    },
    left_meta: [
      { label: "Invoice number", value: "INV-20260424-ABCDEFGH" },
      { label: "Generated", value: "Apr 24, 2026" },
      { label: "Invoice status", value: "Pending" },
    ],
    right_meta: [
      { label: "Order reference", value: "ORD-001" },
      { label: "Customer code", value: "CUST-001" },
      { label: "Line items", value: "2" },
    ],
    notes: "Deliver before Friday.",
    line_items: [
      {
        item: "12oz kraft paper cup",
        notes: "Front logo, black print",
        quantity: 100,
        unit_price: "15.00",
        total: "1500.00",
      },
      {
        item: "80mm coffee lid",
        notes: null,
        quantity: 180,
        unit_price: "5.00",
        total: "900.00",
      },
    ],
    subtotal: "2400.00",
    discount: "0.00",
    total: "2400.00",
    paid_amount: "0.00",
    remaining_balance: "2400.00",
    payment_instructions: [
      "Use the invoice number as the payment reference.",
      "Coordinate payment confirmation with Ink Wave operations before production starts.",
    ],
    support_lines: [
      "Ink Wave Branding App",
      "Coordinate through the assigned order contact for invoice follow-up.",
    ],
    footer_note: "Thank you for your order.",
  })

  assert.ok(Buffer.isBuffer(pdf))
  assert.ok(pdf.byteLength > 0)
  assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF")
  assert.equal(countPdfPages(pdf), 1)
})

test("renderInvoicePdf supports custom_charge invoice lines", async () => {
  const pdf = await renderInvoicePdf({
    brand_name: "Ink Wave Branding App",
    document_title: "Invoice",
    invoice_number: "INV-20260424-CUSTOM01",
    order_reference: "ORD-002",
    generated_at: "Apr 24, 2026",
    status: {
      label: "Paid",
      tone: "success",
    },
    from: {
      label: "From",
      name: "Ink Wave Branding App",
      lines: ["Cup printing operations"],
    },
    to: {
      label: "To",
      name: "Ink Wave Cafe",
      lines: ["Jane Doe", "09170000000", "jane@example.com", "Manila"],
    },
    left_meta: [
      { label: "Invoice number", value: "INV-20260424-CUSTOM01" },
      { label: "Generated", value: "Apr 24, 2026" },
      { label: "Invoice status", value: "Paid" },
    ],
    right_meta: [
      { label: "Order reference", value: "ORD-002" },
      { label: "Customer code", value: "CUST-001" },
      { label: "Line items", value: "1" },
    ],
    notes: null,
    line_items: [
      {
        item: "Rush fee",
        notes: "Approved by customer",
        quantity: 1,
        unit_price: "500.00",
        total: "500.00",
      },
    ],
    subtotal: "500.00",
    discount: "0.00",
    total: "500.00",
    paid_amount: "500.00",
    remaining_balance: "0.00",
    payment_instructions: ["Payment recorded for this invoice."],
    support_lines: [
      "Ink Wave Branding App",
      "Coordinate through the assigned order contact for invoice follow-up.",
    ],
    footer_note: "Thank you for your order.",
  })

  assert.ok(Buffer.isBuffer(pdf))
  assert.ok(pdf.byteLength > 0)
  assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF")
  assert.equal(countPdfPages(pdf), 1)
})

test("renderInvoicePdf does not create a trailing header-only page for compact invoices", async () => {
  const pdf = await renderInvoicePdf({
    brand_name: "Ink Wave Branding App",
    document_title: "Invoice",
    invoice_number: "INV-20260512-COMPACT",
    order_reference: "ORD-003",
    generated_at: "May 12, 2026",
    status: {
      label: "Pending",
      tone: "warning",
    },
    from: {
      label: "From",
      name: "Ink Wave Branding App",
      lines: ["Cup printing operations"],
    },
    to: {
      label: "To",
      name: "Ink Wave Cafe",
      lines: ["Jane Doe", "09170000000", "jane@example.com", "Manila"],
    },
    left_meta: [
      { label: "Invoice number", value: "INV-20260512-COMPACT" },
      { label: "Generated", value: "May 12, 2026" },
      { label: "Invoice status", value: "Pending" },
    ],
    right_meta: [
      { label: "Order reference", value: "ORD-003" },
      { label: "Customer code", value: "CUST-001" },
      { label: "Line items", value: "8" },
    ],
    notes: "Deliver before Friday.",
    line_items: Array.from({ length: 8 }, (_, index) => ({
      item: `Invoice item ${index + 1}`,
      notes: index % 2 === 0 ? null : "Logo print details",
      quantity: 100,
      unit_price: "15.00",
      total: "1500.00",
    })),
    subtotal: "12000.00",
    discount: "0.00",
    total: "12000.00",
    paid_amount: "0.00",
    remaining_balance: "12000.00",
    payment_instructions: [],
    support_lines: [],
    footer_note: null,
  })

  assert.ok(Buffer.isBuffer(pdf))
  assert.ok(pdf.byteLength > 0)
  assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF")
  assert.equal(countPdfPages(pdf), 1)
})
