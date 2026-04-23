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
  brand: z.string(),
  size: z.string(),
  dimension: z.string(),
  material: z.string().nullable(),
  color: z.string().nullable(),
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

export type InventoryMovement = z.infer<typeof inventoryMovementSchema>
export type InventoryBalance = z.infer<typeof inventoryBalanceSchema>

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
