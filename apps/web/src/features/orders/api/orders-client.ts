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

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type Order = z.infer<typeof orderSchema>

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
