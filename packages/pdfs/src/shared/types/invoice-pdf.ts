export type InvoicePdfStatusTone = "warning" | "success" | "danger" | "neutral"

export interface InvoicePdfParty {
  label: string
  name: string
  lines: string[]
}

export interface InvoicePdfMetaItem {
  label: string
  value: string
}

export interface InvoicePdfLineItem {
  item: string
  specs: string
  quantity: number
  unit_price: string
  total: string
}

export interface InvoicePdfData {
  brand_name: string
  document_title: string
  invoice_number: string
  order_reference: string
  generated_at: string
  status: {
    label: string
    tone: InvoicePdfStatusTone
  }
  from: InvoicePdfParty
  to: InvoicePdfParty
  left_meta: InvoicePdfMetaItem[]
  right_meta: InvoicePdfMetaItem[]
  line_items: InvoicePdfLineItem[]
  subtotal: string
  discount: string
  total: string
  paid_amount: string
  remaining_balance: string
  payment_instructions: string[]
  support_lines: string[]
  footer_note: string | null
}
