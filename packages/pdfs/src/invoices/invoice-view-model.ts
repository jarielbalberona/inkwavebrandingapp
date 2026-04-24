import type { PdfStatusTone } from "../shared/components/PdfStatusBadge.js"
import type { InvoicePdfData } from "../shared/types/index.js"

export interface InkWaveInvoiceViewModel {
  brandName: string
  documentTitle: string
  invoiceNumber: string
  orderReference: string
  generatedAt: string
  status: {
    label: string
    tone: PdfStatusTone
  }
  from: {
    label: string
    name: string
    lines: string[]
  }
  to: {
    label: string
    name: string
    lines: string[]
  }
  leftMeta: Array<{
    label: string
    value: string
  }>
  rightMeta: Array<{
    label: string
    value: string
  }>
  lineItems: Array<{
    item: string
    specs: string
    quantity: number
    unitPrice: string
    total: string
  }>
  summary: {
    subtotal: string
    discount: string
    total: string
    paidAmount: string
    remainingBalance: string
  }
  paymentInstructions: string[]
  supportLines: string[]
  footerNote: string
}

export function toInkWaveInvoiceViewModel(invoice: InvoicePdfData): InkWaveInvoiceViewModel {
  const subtotal = sumLineTotals(invoice.items)
  const discount = 0
  const paidAmount = 0
  const total = subtotal - discount
  const remainingBalance = Math.max(total - paidAmount, 0)

  return {
    brandName: "Ink Wave Branding App",
    documentTitle: "Invoice",
    invoiceNumber: invoice.invoice_number,
    orderReference: invoice.order_number_snapshot,
    generatedAt: formatDate(invoice.created_at),
    status: {
      label: "Pending",
      tone: "warning",
    },
    from: {
      label: "From",
      name: "Ink Wave Branding App",
      lines: [
        "Cup printing operations",
        "Production begins after invoice confirmation.",
      ],
    },
    to: {
      label: "To",
      name: invoice.customer.business_name,
      lines: [
        invoice.customer.contact_person,
        invoice.customer.contact_number,
        invoice.customer.email,
        invoice.customer.address,
      ].filter((line): line is string => Boolean(line)),
    },
    leftMeta: [
      { label: "Invoice number", value: invoice.invoice_number },
      { label: "Generated", value: formatDate(invoice.created_at) },
      { label: "Invoice status", value: "Pending" },
    ],
    rightMeta: [
      { label: "Order reference", value: invoice.order_number_snapshot },
      { label: "Customer code", value: invoice.customer.customer_code ?? "N/A" },
      { label: "Line items", value: invoice.items.length.toLocaleString() },
    ],
    lineItems: invoice.items.map((item) => ({
      item: item.description_snapshot,
      specs: formatInvoiceItemType(item.item_type),
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: item.line_total,
    })),
    summary: {
      subtotal: formatMoneyNumber(subtotal),
      discount: formatMoneyNumber(discount),
      total: formatMoneyNumber(total),
      paidAmount: formatMoneyNumber(paidAmount),
      remainingBalance: formatMoneyNumber(remainingBalance),
    },
    paymentInstructions: [
      "Use the invoice number as the payment reference.",
      "Coordinate payment confirmation with Ink Wave operations before production starts.",
    ],
    supportLines: [
      "Ink Wave Branding App",
      "Coordinate through the assigned order contact for invoice follow-up.",
    ],
    footerNote: "Thank you for your order.",
  }
}

function sumLineTotals(items: InvoicePdfData["items"]) {
  return items.reduce((sum, item) => {
    const numeric = Number(item.line_total)
    return Number.isNaN(numeric) ? sum : sum + numeric
  }, 0)
}

function formatMoneyNumber(value: number) {
  return value.toFixed(2)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatInvoiceItemType(itemType: InvoicePdfData["items"][number]["item_type"]) {
  switch (itemType) {
    case "cup":
      return "Cup item"
    case "lid":
      return "Lid item"
    case "non_stock_item":
      return "General item"
    case "custom_charge":
      return "Custom charge"
  }
}
