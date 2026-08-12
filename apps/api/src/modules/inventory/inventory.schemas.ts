import { z } from "zod"

import { inventoryMovementTypes } from "./inventory.rules.js"

export const inventoryMovementTypeSchema = z.enum(inventoryMovementTypes)
export const inventoryItemTypeSchema = z.enum(["cup", "lid", "paper_bowl"])

const inventoryItemReferenceShape = {
  itemType: inventoryItemTypeSchema,
  cupId: z.string().uuid().optional(),
  lidId: z.string().uuid().optional(),
  paperBowlId: z.string().uuid().optional(),
} as const

const inventoryItemReferenceObjectSchema = z.object(inventoryItemReferenceShape)

function withInventoryItemReferenceValidation<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((value, context) => {
    const hasCupId = Boolean(value.cupId)
    const hasLidId = Boolean(value.lidId)
    const hasPaperBowlId = Boolean(value.paperBowlId)

    if ([hasCupId, hasLidId, hasPaperBowlId].filter(Boolean).length !== 1) {
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

    if (value.itemType === "paper_bowl" && !hasPaperBowlId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paper bowl inventory movements require paperBowlId.",
        path: ["paperBowlId"],
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
    paper_bowl_id: z.string().uuid().optional(),
    movement_type: inventoryMovementTypeSchema.optional(),
  })
  .superRefine((value, context) => {
    if ([value.cup_id, value.lid_id, value.paper_bowl_id].filter(Boolean).length > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use only one inventory item filter.",
        path: ["cup_id"],
      })
    }

    if (value.item_type === "cup" && (value.lid_id || value.paper_bowl_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cup filters cannot include another item reference.",
        path: ["lid_id"],
      })
    }

    if (value.item_type === "lid" && (value.cup_id || value.paper_bowl_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lid filters cannot include another item reference.",
        path: ["cup_id"],
      })
    }
    if (value.item_type === "paper_bowl" && (value.cup_id || value.lid_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paper bowl filters cannot include cup_id or lid_id.",
        path: ["paper_bowl_id"],
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
