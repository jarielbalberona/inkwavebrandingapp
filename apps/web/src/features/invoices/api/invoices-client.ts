import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

const invoiceStatusSchema = z.enum(["pending", "paid", "void"])

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
  status: invoiceStatusSchema,
  subtotal: z.string(),
  total_amount: z.string(),
  paid_amount: z.string(),
  remaining_balance: z.string(),
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

const invoicePaymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.string(),
  payment_date: z.string(),
  note: z.string().nullable(),
  created_by: z
    .object({
      id: z.string().uuid(),
      email: z.string().email(),
      display_name: z.string().nullable(),
    })
    .nullable(),
  created_at: z.string(),
  updated_at: z.string(),
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
  status: invoiceStatusSchema,
  subtotal: z.string(),
  total_amount: z.string(),
  paid_amount: z.string(),
  remaining_balance: z.string(),
  due_date: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(invoiceItemSchema),
  payments: z.array(invoicePaymentSchema),
  created_at: z.string(),
  updated_at: z.string(),
})

const invoicesResponseSchema = z.object({
  invoices: z.array(invoiceListItemSchema),
})

const invoiceResponseSchema = z.object({
  invoice: invoiceSchema,
})

const invoiceShareLinkResponseSchema = z.object({
  url: z.string().url(),
  filename: z.string(),
})

export type InvoiceListItem = z.infer<typeof invoiceListItemSchema>
export type Invoice = z.infer<typeof invoiceSchema>
export type InvoiceShareLink = z.infer<typeof invoiceShareLinkResponseSchema>
export interface RecordInvoicePaymentPayload {
  amount: string
  payment_date: string
  note?: string
}

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
      throw new Error("You do not have permission to view invoices.")
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
      throw new Error("You do not have permission to view invoices.")
    }

    if (error instanceof ApiClientError) {
      throw new Error("Unable to load invoice.")
    }

    throw error
  }
}

export async function getInvoiceShareLink(invoiceId: string): Promise<InvoiceShareLink> {
  try {
    const data = await api.get<unknown>(`/invoices/${invoiceId}/share-link`)
    return invoiceShareLinkResponseSchema.parse(data)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new Error("Invoice not found.")
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw new Error("You do not have permission to share invoices.")
    }

    if (error instanceof ApiClientError) {
      throw new Error(error.message || "Unable to create share link.")
    }

    throw error
  }
}

export async function recordInvoicePayment(
  invoiceId: string,
  payload: RecordInvoicePaymentPayload,
): Promise<Invoice> {
  try {
    const data = await api.post<unknown>(`/invoices/${invoiceId}/payments`, payload)
    return invoiceResponseSchema.parse(data).invoice
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new Error("Invoice not found.")
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw new Error("You do not have permission to record invoice payments.")
    }

    if (error instanceof ApiClientError) {
      throw new Error(error.message || "Unable to record payment.")
    }

    throw error
  }
}

export async function voidInvoice(invoiceId: string): Promise<Invoice> {
  try {
    const data = await api.post<unknown>(`/invoices/${invoiceId}/void`, {})
    return invoiceResponseSchema.parse(data).invoice
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new Error("Invoice not found.")
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw new Error("You do not have permission to void invoices.")
    }

    if (error instanceof ApiClientError) {
      throw new Error(error.message || "Unable to void invoice.")
    }

    throw error
  }
}
