import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

const nonStockItemBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const adminNonStockItemSchema = nonStockItemBaseSchema.extend({
  cost_price: z.string().nullable(),
  default_sell_price: z.string(),
})

const staffNonStockItemSchema = nonStockItemBaseSchema
  .extend({
    cost_price: z.undefined().optional(),
    default_sell_price: z.undefined().optional(),
  })
  .strip()

export const nonStockItemSchema = z.union([adminNonStockItemSchema, staffNonStockItemSchema])

const nonStockItemsResponseSchema = z.object({
  non_stock_items: z.array(nonStockItemSchema),
})

export type NonStockItem = z.infer<typeof nonStockItemSchema>

export class NonStockItemsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function listNonStockItems(): Promise<NonStockItem[]> {
  try {
    const response = await api.get<unknown>("/non-stock-items?include_inactive=true")
    return nonStockItemsResponseSchema.parse(response).non_stock_items
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new NonStockItemsApiError("Unable to load general items.", error.status)
    }

    throw error
  }
}
