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

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type Order = z.infer<typeof orderSchema>

export interface CreateOrderPayload {
  customer_id: string
  notes?: string
  line_items: Array<{
    cup_id: string
    quantity: number
    notes?: string
  }>
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
