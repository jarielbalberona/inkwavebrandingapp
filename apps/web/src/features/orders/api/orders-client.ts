import { z } from "zod"

import { customerSchema } from "@/features/customers/api/customers-client"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

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
  brand: z.string(),
  size: z.string(),
  dimension: z.string(),
  material: z.string().nullable(),
  color: z.string().nullable(),
})

const orderItemSchema = z.object({
  id: z.string().uuid(),
  cup: orderCupSchema,
  quantity: z.number().int().positive(),
  notes: z.string().nullable(),
  cost_price: z.string().optional(),
  sell_price: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

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

const ordersResponseSchema = z.object({
  orders: z.array(orderSchema),
})

const orderResponseSchema = z.object({
  order: orderSchema,
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
export type ProgressStage = z.infer<typeof progressStageSchema>
export type ProgressTotals = z.infer<typeof progressTotalsSchema>
export type ProgressEvent = z.infer<typeof progressEventSchema>

export interface CreateOrderPayload {
  customer_id: string
  notes?: string
  line_items: Array<{
    cup_id: string
    quantity: number
    notes?: string
  }>
}

export interface CreateProgressEventPayload {
  stage: ProgressStage
  quantity: number
  note?: string
  event_date: string
}

export class OrdersApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function listOrders(filters: { status?: OrderStatus } = {}): Promise<Order[]> {
  const searchParams = new URLSearchParams()

  if (filters.status) {
    searchParams.set("status", filters.status)
  }

  const queryString = searchParams.toString()
  const response = await fetch(`${apiBaseUrl}/orders${queryString ? `?${queryString}` : ""}`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new OrdersApiError("Unable to load orders.", response.status)
  }

  return ordersResponseSchema.parse(await response.json()).orders
}

export async function getOrder(id: string): Promise<Order> {
  const response = await fetch(`${apiBaseUrl}/orders/${id}`, {
    credentials: "include",
  })

  if (response.status === 404) {
    throw new OrdersApiError("Order no longer exists.", response.status)
  }

  if (!response.ok) {
    throw new OrdersApiError("Unable to load order.", response.status)
  }

  return orderResponseSchema.parse(await response.json()).order
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const response = await fetch(`${apiBaseUrl}/orders`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 400) {
    throw new OrdersApiError("Check the selected customer, cups, and quantities.", response.status)
  }

  if (response.status === 404) {
    throw new OrdersApiError("A selected customer or cup no longer exists.", response.status)
  }

  if (response.status === 409) {
    throw new OrdersApiError(
      "Unable to create order. Check customer/cup status, duplicate cups, or available stock.",
      response.status,
    )
  }

  if (!response.ok) {
    throw new OrdersApiError("Unable to create order.", response.status)
  }

  return orderResponseSchema.parse(await response.json()).order
}

export async function cancelOrder(id: string): Promise<Order> {
  const response = await fetch(`${apiBaseUrl}/orders/${id}/cancel`, {
    method: "PATCH",
    credentials: "include",
  })

  if (response.status === 404) {
    throw new OrdersApiError("Order no longer exists.", response.status)
  }

  if (response.status === 409) {
    throw new OrdersApiError("This order cannot be canceled in its current state.", response.status)
  }

  if (!response.ok) {
    throw new OrdersApiError("Unable to cancel order.", response.status)
  }

  return orderResponseSchema.parse(await response.json()).order
}

export async function listProgressEvents(orderLineItemId: string): Promise<{
  events: ProgressEvent[]
  totals: ProgressTotals
}> {
  const response = await fetch(`${apiBaseUrl}/order-line-items/${orderLineItemId}/progress-events`, {
    credentials: "include",
  })

  if (response.status === 404) {
    throw new OrdersApiError("Order line item no longer exists.", response.status)
  }

  if (!response.ok) {
    throw new OrdersApiError("Unable to load progress events.", response.status)
  }

  return progressEventsResponseSchema.parse(await response.json())
}

export async function createProgressEvent(
  orderLineItemId: string,
  payload: CreateProgressEventPayload,
): Promise<{
  event: ProgressEvent
  totals: ProgressTotals
  order_status: OrderStatus
}> {
  const response = await fetch(`${apiBaseUrl}/order-line-items/${orderLineItemId}/progress-events`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 400) {
    throw new OrdersApiError("Enter a valid progress stage, quantity, and event date.", response.status)
  }

  if (response.status === 404) {
    throw new OrdersApiError("Order line item no longer exists.", response.status)
  }

  if (response.status === 409) {
    throw new OrdersApiError("Progress quantity exceeds the allowed stage balance.", response.status)
  }

  if (!response.ok) {
    throw new OrdersApiError("Unable to record progress event.", response.status)
  }

  return createProgressEventResponseSchema.parse(await response.json())
}
