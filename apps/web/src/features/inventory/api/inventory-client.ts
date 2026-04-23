import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

const inventoryMovementTypeSchema = z.enum([
  "stock_in",
  "reserve",
  "release_reservation",
  "consume",
  "adjustment_in",
  "adjustment_out",
])

const cupSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  type: z.enum(["paper", "plastic"]),
  brand: z.string(),
  diameter: z.enum(["80mm", "90mm", "95mm", "98mm"]),
  size: z.string(),
  color: z.enum(["transparent", "black", "white", "kraft"]),
  min_stock: z.number(),
  is_active: z.boolean(),
  cost_price: z.string().optional(),
  default_sell_price: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

const lidSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  type: z.enum(["paper", "plastic"]),
  brand: z.string(),
  diameter: z.enum(["80mm", "90mm", "95mm", "98mm"]),
  shape: z.string(),
  color: z.enum(["transparent", "black", "white"]),
  is_active: z.boolean(),
  cost_price: z.string().optional(),
  default_sell_price: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

const inventoryBalanceSchema = z.discriminatedUnion("item_type", [
  z.object({
    item_type: z.literal("cup"),
    cup: cupSchema,
    lid: z.null(),
    on_hand: z.number(),
    reserved: z.number(),
    available: z.number(),
  }),
  z.object({
    item_type: z.literal("lid"),
    cup: z.null(),
    lid: lidSchema,
    on_hand: z.number(),
    reserved: z.number(),
    available: z.number(),
  }),
])

const inventoryBalancesResponseSchema = z.object({
  balances: z.array(inventoryBalanceSchema),
})

const inventoryMovementListItemSchema = z.discriminatedUnion("item_type", [
  z.object({
    id: z.string().uuid(),
    item_type: z.literal("cup"),
    movement_type: inventoryMovementTypeSchema,
    quantity: z.number().int().positive(),
    note: z.string().nullable(),
    reference: z.string().nullable(),
    order_id: z.string().uuid().nullable(),
    order_item_id: z.string().uuid().nullable(),
    created_at: z.string(),
    cup: cupSchema,
    lid: z.null(),
    created_by: z
      .object({
        id: z.string().uuid(),
        display_name: z.string().nullable(),
        email: z.string().email(),
      })
      .nullable(),
  }),
  z.object({
    id: z.string().uuid(),
    item_type: z.literal("lid"),
    movement_type: inventoryMovementTypeSchema,
    quantity: z.number().int().positive(),
    note: z.string().nullable(),
    reference: z.string().nullable(),
    order_id: z.string().uuid().nullable(),
    order_item_id: z.string().uuid().nullable(),
    created_at: z.string(),
    cup: z.null(),
    lid: lidSchema,
    created_by: z
      .object({
        id: z.string().uuid(),
        display_name: z.string().nullable(),
        email: z.string().email(),
      })
      .nullable(),
  }),
])

const inventoryMovementsResponseSchema = z.object({
  movements: z.array(inventoryMovementListItemSchema),
})

const inventoryMovementSchema = z.object({
  id: z.string().uuid(),
  itemType: z.enum(["cup", "lid"]),
  cupId: z.string().uuid().nullable(),
  lidId: z.string().uuid().nullable(),
  movementType: inventoryMovementTypeSchema,
  quantity: z.number().int().positive(),
  orderId: z.string().uuid().nullable(),
  orderItemId: z.string().uuid().nullable(),
  note: z.string().nullable(),
  reference: z.string().nullable(),
  createdByUserId: z.string().uuid().nullable(),
  createdAt: z.string(),
})

const stockIntakeResponseSchema = z.object({
  movement: inventoryMovementSchema,
})

export type InventoryMovement = z.infer<typeof inventoryMovementSchema>
export type InventoryBalance = z.infer<typeof inventoryBalanceSchema>
export type InventoryMovementListItem = z.infer<typeof inventoryMovementListItemSchema>
export type InventoryItemType = z.infer<typeof inventoryBalanceSchema>["item_type"]

export type StockIntakePayload =
  | {
      itemType: "cup"
      cupId: string
      lidId?: undefined
      quantity: number
      note?: string
      reference?: string
    }
  | {
      itemType: "lid"
      cupId?: undefined
      lidId: string
      quantity: number
      note?: string
      reference?: string
    }

export async function listInventoryBalances(filters?: {
  includeInactive?: boolean
  itemType?: InventoryItemType
}): Promise<InventoryBalance[]> {
  const searchParams = new URLSearchParams()

  if (filters?.includeInactive) {
    searchParams.set("include_inactive", "true")
  }

  if (filters?.itemType) {
    searchParams.set("item_type", filters.itemType)
  }

  const data = await api.get<unknown>(
    `/inventory/balances${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`,
  )

  return inventoryBalancesResponseSchema.parse(data).balances
}

export async function listInventoryMovements(filters: {
  itemType?: InventoryItemType
  itemId?: string
  movementType?: string
}): Promise<InventoryMovementListItem[]> {
  const searchParams = new URLSearchParams()

  if (filters.itemType) {
    searchParams.set("item_type", filters.itemType)
  }

  if (filters.itemId && filters.itemType) {
    if (filters.itemType === "lid") {
      searchParams.set("lid_id", filters.itemId)
    } else {
      searchParams.set("cup_id", filters.itemId)
    }
  }

  if (filters.movementType) {
    searchParams.set("movement_type", filters.movementType)
  }

  const data = await api.get<unknown>(`/inventory/movements?${searchParams.toString()}`)
  return inventoryMovementsResponseSchema.parse(data).movements
}

export async function createStockIntake(payload: StockIntakePayload): Promise<InventoryMovement> {
  try {
    const data = await api.post<unknown, StockIntakePayload>("/inventory/stock-intake", payload)
    return stockIntakeResponseSchema.parse(data).movement
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 403) {
        throw new Error("Only admins can receive stock into inventory.")
      }

      if (error.status === 404) {
        throw new Error(
          payload.itemType === "cup"
            ? "Selected cup no longer exists."
            : "Selected lid no longer exists.",
        )
      }

      if (error.status === 409) {
        throw new Error(
          payload.itemType === "cup"
            ? "Selected cup is inactive and cannot receive stock."
            : "Selected lid is inactive and cannot receive stock.",
        )
      }

      if (error.status === 400) {
        throw new Error("Enter a valid inventory item and a positive quantity.")
      }

      throw new Error("Unable to record stock intake.")
    }

    throw error
  }
}
