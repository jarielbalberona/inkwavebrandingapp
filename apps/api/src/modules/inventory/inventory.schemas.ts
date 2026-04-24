import { z } from "zod"

import { inventoryMovementTypes } from "./inventory.rules.js"

export const inventoryMovementTypeSchema = z.enum(inventoryMovementTypes)
export const inventoryItemTypeSchema = z.enum(["cup", "lid"])

const inventoryItemReferenceShape = {
  itemType: inventoryItemTypeSchema,
  cupId: z.string().uuid().optional(),
  lidId: z.string().uuid().optional(),
} as const

const inventoryItemReferenceObjectSchema = z.object(inventoryItemReferenceShape)

function withInventoryItemReferenceValidation<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((value, context) => {
    const hasCupId = Boolean(value.cupId)
    const hasLidId = Boolean(value.lidId)

    if (hasCupId === hasLidId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one inventory item reference must be set.",
        path: hasCupId ? ["lidId"] : ["cupId"],
      })
    }

    if (value.itemType === "cup" && !hasCupId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cup inventory movements require cupId.",
        path: ["cupId"],
      })
    }

    if (value.itemType === "lid" && !hasLidId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lid inventory movements require lidId.",
        path: ["lidId"],
      })
    }
  }) as unknown as T
}

export const appendInventoryMovementSchema = withInventoryItemReferenceValidation(
  inventoryItemReferenceObjectSchema.extend({
    movementType: inventoryMovementTypeSchema,
    quantity: z.number().int().positive(),
    orderId: z.string().uuid().optional(),
    orderItemId: z.string().uuid().optional(),
    note: z.string().trim().max(500).optional(),
    reference: z.string().trim().max(160).optional(),
    createdByUserId: z.string().uuid().optional(),
  }),
)

export const stockIntakeRequestSchema = withInventoryItemReferenceValidation(
  inventoryItemReferenceObjectSchema.extend({
    quantity: z.number().int().positive(),
    note: z.string().trim().max(500).optional(),
    reference: z.string().trim().max(160).optional(),
  }),
)

export const inventoryBalanceQuerySchema = z.object({
  include_inactive: z.coerce.boolean().default(false),
  item_type: inventoryItemTypeSchema.optional(),
})

export const inventoryMovementsQuerySchema = z
  .object({
    item_type: inventoryItemTypeSchema.optional(),
    cup_id: z.string().uuid().optional(),
    lid_id: z.string().uuid().optional(),
    movement_type: inventoryMovementTypeSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.cup_id && value.lid_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use either cup_id or lid_id, not both.",
        path: ["cup_id"],
      })
    }

    if (value.item_type === "cup" && value.lid_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cup filters cannot include lid_id.",
        path: ["lid_id"],
      })
    }

    if (value.item_type === "lid" && value.cup_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lid filters cannot include cup_id.",
        path: ["cup_id"],
      })
    }
  })

export const inventoryAdjustmentTypeSchema = z.enum([
  "adjustment_in",
  "adjustment_out",
])

export const inventoryAdjustmentRequestSchema = withInventoryItemReferenceValidation(
  inventoryItemReferenceObjectSchema.extend({
    movementType: inventoryAdjustmentTypeSchema,
    quantity: z.number().int().positive(),
    note: z.string().trim().min(1).max(500),
    reference: z.string().trim().max(160).optional(),
  }),
)

export const reserveOrderItemsSchema = z.object({
  orderId: z.string().uuid(),
  createdByUserId: z.string().uuid().optional(),
  items: z.array(
    withInventoryItemReferenceValidation(
      inventoryItemReferenceObjectSchema.extend({
        orderItemId: z.string().uuid(),
        requestLineItemIndex: z.number().int().nonnegative().optional(),
        quantity: z.number().int().positive(),
      }),
    ),
  ).min(1),
})

export type AppendInventoryMovementInput = z.infer<typeof appendInventoryMovementSchema>
export type StockIntakeRequest = z.infer<typeof stockIntakeRequestSchema>
export type InventoryBalanceQuery = z.infer<typeof inventoryBalanceQuerySchema>
export type InventoryMovementsQuery = z.infer<typeof inventoryMovementsQuerySchema>
export type InventoryAdjustmentRequest = z.infer<typeof inventoryAdjustmentRequestSchema>
export type ReserveOrderItemsInput = z.infer<typeof reserveOrderItemsSchema>
