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

const nonStockItemResponseSchema = z.object({
  non_stock_item: nonStockItemSchema,
})

const nonStockItemRequestErrorSchema = z.object({
  error: z.string(),
  details: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
})

export type NonStockItem = z.infer<typeof nonStockItemSchema>

export interface NonStockItemPayload {
  name: string
  description?: string | null
  cost_price?: string | null
  default_sell_price: string
  is_active: boolean
}

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

export async function createNonStockItem(payload: NonStockItemPayload): Promise<NonStockItem> {
  const response = await sendNonStockItemRequest("/non-stock-items", "POST", payload)
  return nonStockItemResponseSchema.parse(response).non_stock_item
}

export async function updateNonStockItem(
  id: string,
  payload: NonStockItemPayload,
): Promise<NonStockItem> {
  const response = await sendNonStockItemRequest(`/non-stock-items/${id}`, "PATCH", payload)
  return nonStockItemResponseSchema.parse(response).non_stock_item
}

function formatNonStockItemRequestError(data: unknown): string | null {
  const parsed = nonStockItemRequestErrorSchema.safeParse(data)

  if (!parsed.success) {
    return null
  }

  const details = parsed.data.details
    ?.map((detail) => (detail.path ? `${detail.path}: ${detail.message}` : detail.message))
    .filter(Boolean)

  if (details?.length) {
    return `${parsed.data.error}. ${details.join(" ")}`
  }

  return parsed.data.error
}

async function sendNonStockItemRequest(
  path: string,
  method: "POST" | "PATCH",
  payload: NonStockItemPayload,
) {
  try {
    return method === "POST"
      ? await api.post<unknown, typeof payload>(path, payload)
      : await api.patch<unknown, typeof payload>(path, payload)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 400) {
      throw new NonStockItemsApiError(
        formatNonStockItemRequestError(error.data) ?? error.message ?? "Invalid general item request.",
        error.status,
      )
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw new NonStockItemsApiError("You do not have permission to change general item records.", error.status)
    }

    if (error instanceof ApiClientError && error.status === 404) {
      throw new NonStockItemsApiError("General item no longer exists.", error.status)
    }

    if (error instanceof ApiClientError && error.status === 409) {
      throw new NonStockItemsApiError("General item name already exists.", error.status)
    }

    if (error instanceof ApiClientError) {
      throw new NonStockItemsApiError("Unable to save general item.", error.status)
    }

    throw error
  }
}
