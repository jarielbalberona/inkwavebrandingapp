import type { InvoicePdfData } from "@workspace/pdfs/server"

import { toInvoiceDto } from "./invoices.types.js"

export function toInvoicePdfData(invoice: ReturnType<typeof toInvoiceDto>): InvoicePdfData {
  return {
    brand_name: "Ink Wave Branding App",
    document_title: "Invoice",
    invoice_number: invoice.invoice_number,
    order_reference: invoice.order_number_snapshot,
    generated_at: formatInvoicePdfDate(invoice.created_at),
    status: toInvoicePdfStatus(invoice.status),
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
    left_meta: [
      { label: "Invoice number", value: invoice.invoice_number },
      { label: "Generated", value: formatInvoicePdfDate(invoice.created_at) },
      { label: "Invoice status", value: toInvoicePdfStatus(invoice.status).label },
    ],
    right_meta: [
      { label: "Order reference", value: invoice.order_number_snapshot },
      { label: "Customer code", value: invoice.customer.customer_code ?? "N/A" },
      { label: "Line items", value: invoice.items.length.toLocaleString() },
    ],
    line_items: invoice.items.map((item) => ({
      item: item.description_snapshot,
      specs: toInvoicePdfSpecs(item.item_type),
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.line_total,
    })),
    subtotal: invoice.subtotal,
    discount: "0.00",
    total: invoice.subtotal,
    paid_amount: invoice.status === "paid" ? invoice.subtotal : "0.00",
    remaining_balance: invoice.status === "pending" ? invoice.subtotal : "0.00",
    payment_instructions: toInvoicePdfPaymentInstructions(invoice.status),
    support_lines: [
      "Ink Wave Branding App",
      "Coordinate through the assigned order contact for invoice follow-up.",
    ],
    footer_note: invoice.status === "void" ? "This invoice has been voided." : "Thank you for your order.",
  }
}

function formatInvoicePdfDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function toInvoicePdfStatus(status: ReturnType<typeof toInvoiceDto>["status"]) {
  switch (status) {
    case "paid":
      return { label: "Paid", tone: "success" as const }
    case "void":
      return { label: "Void", tone: "danger" as const }
    default:
      return { label: "Pending", tone: "warning" as const }
  }
}

function toInvoicePdfSpecs(itemType: ReturnType<typeof toInvoiceDto>["items"][number]["item_type"]) {
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

function toInvoicePdfPaymentInstructions(status: ReturnType<typeof toInvoiceDto>["status"]) {
  switch (status) {
    case "paid":
      return ["Payment received. Production or release may proceed per operations workflow."]
    case "void":
      return ["This invoice is void and should not be used for payment collection."]
    default:
      return [
        "Treat this invoice as pending until payment is confirmed by an admin.",
        "Do not begin production from this document alone.",
      ]
  }
}
