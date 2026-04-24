import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

const invoiceListItemSchema = z.object({
  id: z.string().uuid(),
  invoice_number: z.string(),
  order_id: z.string().uuid(),
  order_number_snapshot: z.string(),
  customer: z.object({
    id: z.string().uuid(),
    customer_code: z.string().nullable(),
    business_name: z.string(),
  }),
  subtotal: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

const invoiceItemSchema = z.object({
  id: z.string().uuid(),
  order_line_item_id: z.string().uuid(),
  item_type: z.enum(["cup", "lid", "non_stock_item", "custom_charge"]),
  description_snapshot: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.string(),
  line_total: z.string(),
  created_at: z.string(),
})

const invoiceSchema = z.object({
  id: z.string().uuid(),
  invoice_number: z.string(),
  order_id: z.string().uuid(),
  order_number_snapshot: z.string(),
  customer: z.object({
    id: z.string().uuid(),
    customer_code: z.string().nullable(),
    business_name: z.string(),
    contact_person: z.string().nullable(),
    contact_number: z.string().nullable(),
    email: z.string().nullable(),
    address: z.string().nullable(),
  }),
  subtotal: z.string(),
  items: z.array(invoiceItemSchema),
  created_at: z.string(),
  updated_at: z.string(),
})

const invoicesResponseSchema = z.object({
  invoices: z.array(invoiceListItemSchema),
})

const invoiceResponseSchema = z.object({
  invoice: invoiceSchema,
})

export type InvoiceListItem = z.infer<typeof invoiceListItemSchema>
export type Invoice = z.infer<typeof invoiceSchema>

export interface ListInvoicesFilters {
  search?: string
}

export async function listInvoices(filters: ListInvoicesFilters = {}): Promise<InvoiceListItem[]> {
  try {
    const searchParams = new URLSearchParams()

    if (filters.search?.trim()) {
      searchParams.set("search", filters.search.trim())
    }

    const data = await api.get<unknown>(
      `/invoices${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`,
    )

    return invoicesResponseSchema.parse(data).invoices
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 403) {
      throw new Error("Only admins can view invoices.")
    }

    if (error instanceof ApiClientError) {
      throw new Error("Unable to load invoices.")
    }

    throw error
  }
}

export async function getInvoice(invoiceId: string): Promise<Invoice> {
  try {
    const data = await api.get<unknown>(`/invoices/${invoiceId}`)
    return invoiceResponseSchema.parse(data).invoice
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new Error("Invoice not found.")
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw new Error("Only admins can view invoices.")
    }

    if (error instanceof ApiClientError) {
      throw new Error("Unable to load invoice.")
    }

    throw error
  }
}
