import { z } from "zod"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

const inventoryMovementSchema = z.object({
  id: z.string().uuid(),
  cupId: z.string().uuid(),
  movementType: z.enum([
    "stock_in",
    "reserve",
    "release_reservation",
    "consume",
    "adjustment_in",
    "adjustment_out",
  ]),
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

const balanceCupSchema = z.object({
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

const inventoryBalanceSchema = z.object({
  cup: balanceCupSchema,
  on_hand: z.number(),
  reserved: z.number(),
  available: z.number(),
})

const inventoryBalancesResponseSchema = z.object({
  balances: z.array(inventoryBalanceSchema),
})

const inventoryMovementListItemSchema = z.object({
  id: z.string().uuid(),
  movement_type: z.enum([
    "stock_in",
    "reserve",
    "release_reservation",
    "consume",
    "adjustment_in",
    "adjustment_out",
  ]),
  quantity: z.number().int().positive(),
  note: z.string().nullable(),
  reference: z.string().nullable(),
  order_id: z.string().uuid().nullable(),
  order_item_id: z.string().uuid().nullable(),
  created_at: z.string(),
  cup: balanceCupSchema,
  created_by: z
    .object({
      id: z.string().uuid(),
      display_name: z.string().nullable(),
      email: z.string().email(),
    })
    .nullable(),
})

const inventoryMovementsResponseSchema = z.object({
  movements: z.array(inventoryMovementListItemSchema),
})

export type InventoryMovement = z.infer<typeof inventoryMovementSchema>
export type InventoryBalance = z.infer<typeof inventoryBalanceSchema>
export type InventoryMovementListItem = z.infer<typeof inventoryMovementListItemSchema>

export interface StockIntakePayload {
  cupId: string
  quantity: number
  note?: string
  reference?: string
}

export class InventoryApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function listInventoryBalances(): Promise<InventoryBalance[]> {
  const response = await fetch(`${apiBaseUrl}/inventory/balances`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new InventoryApiError("Unable to load inventory balances.", response.status)
  }

  return inventoryBalancesResponseSchema.parse(await response.json()).balances
}

export async function listInventoryMovements(filters: {
  cupId?: string
  movementType?: string
}): Promise<InventoryMovementListItem[]> {
  const searchParams = new URLSearchParams()

  if (filters.cupId) {
    searchParams.set("cup_id", filters.cupId)
  }

  if (filters.movementType) {
    searchParams.set("movement_type", filters.movementType)
  }

  const response = await fetch(`${apiBaseUrl}/inventory/movements?${searchParams.toString()}`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new InventoryApiError("Unable to load inventory movements.", response.status)
  }

  return inventoryMovementsResponseSchema.parse(await response.json()).movements
}

export async function createStockIntake(payload: StockIntakePayload): Promise<InventoryMovement> {
  const response = await fetch(`${apiBaseUrl}/inventory/stock-intake`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 403) {
    throw new InventoryApiError("Only admins can receive stock into inventory.", response.status)
  }

  if (response.status === 404) {
    throw new InventoryApiError("Selected cup no longer exists.", response.status)
  }

  if (response.status === 409) {
    throw new InventoryApiError("Selected cup is inactive and cannot receive stock.", response.status)
  }

  if (response.status === 400) {
    throw new InventoryApiError("Enter a valid cup and a positive quantity.", response.status)
  }

  if (!response.ok) {
    throw new InventoryApiError("Unable to record stock intake.", response.status)
  }

  return stockIntakeResponseSchema.parse(await response.json()).movement
}
