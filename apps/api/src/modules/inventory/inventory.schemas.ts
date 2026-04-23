import { z } from "zod"

import { inventoryMovementTypes } from "./inventory.rules.js"

export const inventoryMovementTypeSchema = z.enum(inventoryMovementTypes)

export const appendInventoryMovementSchema = z.object({
  cupId: z.string().uuid(),
  movementType: inventoryMovementTypeSchema,
  quantity: z.number().int().positive(),
  orderId: z.string().uuid().optional(),
  orderItemId: z.string().uuid().optional(),
  note: z.string().trim().max(500).optional(),
  reference: z.string().trim().max(160).optional(),
  createdByUserId: z.string().uuid().optional(),
})

export const stockIntakeRequestSchema = z.object({
  cupId: z.string().uuid(),
  quantity: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
  reference: z.string().trim().max(160).optional(),
})

export const inventoryBalanceQuerySchema = z.object({
  include_inactive: z.coerce.boolean().default(false),
})

export const inventoryMovementsQuerySchema = z.object({
  cup_id: z.string().uuid().optional(),
  movement_type: inventoryMovementTypeSchema.optional(),
})

export const inventoryAdjustmentTypeSchema = z.enum([
  "adjustment_in",
  "adjustment_out",
])

export const inventoryAdjustmentRequestSchema = z.object({
  cupId: z.string().uuid(),
  movementType: inventoryAdjustmentTypeSchema,
  quantity: z.number().int().positive(),
  note: z.string().trim().min(1).max(500),
  reference: z.string().trim().max(160).optional(),
})

export const reserveOrderItemsSchema = z.object({
  orderId: z.string().uuid(),
  createdByUserId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      orderItemId: z.string().uuid(),
      cupId: z.string().uuid(),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
})

export type AppendInventoryMovementInput = z.infer<typeof appendInventoryMovementSchema>
export type StockIntakeRequest = z.infer<typeof stockIntakeRequestSchema>
export type InventoryBalanceQuery = z.infer<typeof inventoryBalanceQuerySchema>
export type InventoryMovementsQuery = z.infer<typeof inventoryMovementsQuerySchema>
export type InventoryAdjustmentRequest = z.infer<typeof inventoryAdjustmentRequestSchema>
export type ReserveOrderItemsInput = z.infer<typeof reserveOrderItemsSchema>
