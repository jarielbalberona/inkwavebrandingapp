export interface InvoicePdfItem {
  id: string
  item_type: "cup" | "lid" | "non_stock_item" | "custom_charge"
  description_snapshot: string
  quantity: number
  unit_price: string
  line_total: string
}

export interface InvoicePdfCustomer {
  customer_code: string | null
  business_name: string
  contact_person: string | null
  contact_number: string | null
  email: string | null
  address: string | null
}

export interface InvoicePdfData {
  invoice_number: string
  order_number_snapshot: string
  subtotal: string
  created_at: string
  customer: InvoicePdfCustomer
  items: InvoicePdfItem[]
}
