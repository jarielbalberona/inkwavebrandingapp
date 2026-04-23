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

export type AppendInventoryMovementInput = z.infer<typeof appendInventoryMovementSchema>
export type StockIntakeRequest = z.infer<typeof stockIntakeRequestSchema>
