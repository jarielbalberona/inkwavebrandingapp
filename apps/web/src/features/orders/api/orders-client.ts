import { z } from "zod"

import { customerSchema } from "@/features/customers/api/customers-client"
import { ApiClientError, api } from "@/lib/api"

export const orderStatusSchema = z.enum([
  "pending",
  "in_progress",
  "partial_released",
  "completed",
  "canceled",
])

export const progressStageSchema = z.enum([
  "printed",
  "qa_passed",
  "packed",
  "ready_for_release",
  "released",
])

const orderCupSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  type: z.enum(["paper", "plastic"]),
  brand: z.string(),
  diameter: z.enum(["80mm", "90mm", "95mm", "98mm"]),
  size: z.string(),
  color: z.enum(["transparent", "black", "white", "kraft"]),
})

const orderLidSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  type: z.enum(["paper", "plastic"]),
  brand: z.string(),
  diameter: z.enum(["80mm", "90mm", "95mm", "98mm"]),
  shape: z.string(),
  color: z.enum(["transparent", "black", "white"]),
})

const orderItemSchema = z.discriminatedUnion("item_type", [
  z.object({
    id: z.string().uuid(),
    item_type: z.literal("cup"),
    cup: orderCupSchema,
    lid: z.null(),
    description_snapshot: z.string(),
    quantity: z.number().int().positive(),
    notes: z.string().nullable(),
    unit_cost_price: z.string().optional(),
    unit_sell_price: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  z.object({
    id: z.string().uuid(),
    item_type: z.literal("lid"),
    cup: z.null(),
    lid: orderLidSchema,
    description_snapshot: z.string(),
    quantity: z.number().int().positive(),
    notes: z.string().nullable(),
    unit_cost_price: z.string().optional(),
    unit_sell_price: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
])

const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  status: orderStatusSchema,
  customer: customerSchema,
  items: z.array(orderItemSchema),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

const invoiceItemSchema = z.object({
  id: z.string().uuid(),
  order_line_item_id: z.string().uuid(),
  item_type: z.enum(["cup", "lid"]),
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

const ordersResponseSchema = z.object({
  orders: z.array(orderSchema),
})

const orderResponseSchema = z.object({
  order: orderSchema,
})

const invoiceResponseSchema = z.object({
  invoice: invoiceSchema,
})

const progressTotalsSchema = z.object({
  total_printed: z.number(),
  total_qa_passed: z.number(),
  total_packed: z.number(),
  total_ready_for_release: z.number(),
  total_released: z.number(),
  remaining_balance: z.number(),
})

const progressEventSchema = z.object({
  id: z.string().uuid(),
  order_line_item_id: z.string().uuid(),
  stage: progressStageSchema,
  quantity: z.number().int().positive(),
  note: z.string().nullable(),
  event_date: z.string(),
  created_by: z
    .object({
      id: z.string().uuid(),
      display_name: z.string().nullable(),
    })
    .nullable(),
  created_at: z.string(),
})

const progressEventsResponseSchema = z.object({
  events: z.array(progressEventSchema),
  totals: progressTotalsSchema,
})

const createProgressEventResponseSchema = z.object({
  event: progressEventSchema,
  totals: progressTotalsSchema,
  order_status: orderStatusSchema,
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type Order = z.infer<typeof orderSchema>
export type Invoice = z.infer<typeof invoiceSchema>
export type ProgressStage = z.infer<typeof progressStageSchema>
export type ProgressTotals = z.infer<typeof progressTotalsSchema>
export type ProgressEvent = z.infer<typeof progressEventSchema>

export interface CreateOrderPayload {
  customer_id: string
  notes?: string
  line_items: Array<
    | {
        item_type: "cup"
        cup_id: string
        quantity: number
        notes?: string
      }
    | {
        item_type: "lid"
        lid_id: string
        quantity: number
        notes?: string
      }
  >
}

export interface CreateProgressEventPayload {
  stage: ProgressStage
  quantity: number
  note?: string
  event_date: string
}

export interface UpdateOrderPayload {
  customer_id?: string
  notes?: string | null
}

export async function getOrderInvoice(orderId: string): Promise<Invoice> {
  try {
    const data = await api.get<unknown>(`/orders/${orderId}/invoice`)
    return invoiceResponseSchema.parse(data).invoice
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new Error("No invoice has been generated for this order yet.")
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

export async function generateOrderInvoice(orderId: string): Promise<Invoice> {
  try {
    const data = await api.post<unknown, undefined>(`/orders/${orderId}/invoice`)
    return invoiceResponseSchema.parse(data).invoice
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 403) {
      throw new Error("Only admins can generate invoices.")
    }

    if (error instanceof ApiClientError && error.status === 404) {
      throw new Error("Order no longer exists.")
    }

    if (error instanceof ApiClientError && error.status === 409) {
      throw new Error(error.message || "Invoice generation is not allowed for this order.")
    }

    if (error instanceof ApiClientError) {
      throw new Error("Unable to generate invoice.")
    }

    throw error
  }
}

export async function listOrders(filters: { status?: OrderStatus } = {}): Promise<Order[]> {
  const searchParams = new URLSearchParams()

  if (filters.status) {
    searchParams.set("status", filters.status)
  }

  const data = await api.get<unknown>(`/orders${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`)
  return ordersResponseSchema.parse(data).orders
}

export async function getOrder(id: string): Promise<Order> {
  try {
    const data = await api.get<unknown>(`/orders/${id}`)
    return orderResponseSchema.parse(data).order
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new Error("Order no longer exists.")
    }

    if (error instanceof ApiClientError) {
      throw new Error("Unable to load order.")
    }

    throw error
  }
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  try {
    const data = await api.post<unknown, CreateOrderPayload>("/orders", payload)
    return orderResponseSchema.parse(data).order
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 400) {
        throw new Error("Check the selected customer, items, and quantities.")
      }

      if (error.status === 404) {
        throw new Error("A selected customer, cup, or lid no longer exists.")
      }

      if (error.status === 409) {
        throw new Error(
          "Unable to create order. Check customer/item status, duplicate items, or available stock.",
        )
      }

      throw new Error("Unable to create order.")
    }

    throw error
  }
}

export async function cancelOrder(id: string): Promise<Order> {
  try {
    const data = await api.patch<unknown, undefined>(`/orders/${id}/cancel`)
    return orderResponseSchema.parse(data).order
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 404) {
        throw new Error("Order no longer exists.")
      }

      if (error.status === 409) {
        throw new Error("This order cannot be canceled in its current state.")
      }

      throw new Error("Unable to cancel order.")
    }

    throw error
  }
}

export async function updateOrder(id: string, payload: UpdateOrderPayload): Promise<Order> {
  try {
    const data = await api.patch<unknown, UpdateOrderPayload>(`/orders/${id}`, payload)
    return orderResponseSchema.parse(data).order
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 400) {
        throw new Error("Only customer and notes can be edited.")
      }

      if (error.status === 404) {
        throw new Error("Order or selected customer no longer exists.")
      }

      if (error.status === 409) {
        throw new Error(
          "Order cannot be edited in its current state, or the selected customer is inactive.",
        )
      }

      throw new Error("Unable to update order.")
    }

    throw error
  }
}

export async function listProgressEvents(orderLineItemId: string): Promise<{
  events: ProgressEvent[]
  totals: ProgressTotals
}> {
  try {
    const data = await api.get<unknown>(`/order-line-items/${orderLineItemId}/progress-events`)
    return progressEventsResponseSchema.parse(data)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new Error("Order line item no longer exists.")
    }

    if (error instanceof ApiClientError) {
      throw new Error(error.message || "Unable to load progress events.")
    }

    throw error
  }
}

export async function createProgressEvent(
  orderLineItemId: string,
  payload: CreateProgressEventPayload,
): Promise<{
  event: ProgressEvent
  totals: ProgressTotals
  order_status: OrderStatus
}> {
  try {
    const data = await api.post<unknown, CreateProgressEventPayload>(
      `/order-line-items/${orderLineItemId}/progress-events`,
      payload,
    )

    return createProgressEventResponseSchema.parse(data)
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 400) {
        throw new Error("Enter a valid progress stage, quantity, and event date.")
      }

      if (error.status === 404) {
        throw new Error("Order line item no longer exists.")
      }

      if (error.status === 409) {
        throw new Error(error.message || "Progress quantity exceeds the allowed stage balance.")
      }

      throw new Error("Unable to record progress event.")
    }

    throw error
  }
}
