import { z } from "zod"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value))

const nullableOptionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => {
      if (value === "") {
        return null
      }

      return value
    })

const moneyStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid non-negative money amount")

export const orderStatusSchema = z.enum([
  "pending",
  "in_progress",
  "partial_released",
  "completed",
  "canceled",
])

export const orderLineItemProgressStageSchema = z.enum([
  "printed",
  "qa_passed",
  "packed",
  "ready_for_release",
  "released",
])

export const createOrderSchema = z.object({
  customer_id: z.string().uuid(),
  notes: optionalText(1000),
  line_items: z
    .array(
      z.discriminatedUnion("item_type", [
        z.object({
          item_type: z.literal("cup"),
          cup_id: z.string().uuid(),
          quantity: z.number().int().positive(),
          notes: optionalText(500),
        }),
      z.object({
        item_type: z.literal("lid"),
        lid_id: z.string().uuid(),
        quantity: z.number().int().positive(),
        notes: optionalText(500),
      }),
      z.object({
        item_type: z.literal("non_stock_item"),
        non_stock_item_id: z.string().uuid(),
        quantity: z.number().int().positive(),
        notes: optionalText(500),
      }),
      z.object({
        item_type: z.literal("custom_charge"),
        description_snapshot: z.string().trim().min(1).max(500),
        quantity: z.number().int().positive(),
        unit_sell_price: moneyStringSchema,
        unit_cost_price: moneyStringSchema.optional(),
        notes: optionalText(500),
      }),
    ]),
    )
    .min(1),
})

export const createOrderLineItemProgressEventSchema = z.object({
  stage: orderLineItemProgressStageSchema,
  quantity: z.number().int().positive(),
  note: optionalText(500),
  event_date: z.coerce.date(),
})

export const updateOrderSchema = z
  .object({
    customer_id: z.string().uuid().optional(),
    notes: nullableOptionalText(1000),
  })
  .strict()
  .refine((input) => input.customer_id !== undefined || input.notes !== undefined, {
    message: "At least one supported order field is required",
  })

export const updateOrderPrioritiesSchema = z
  .object({
    order_ids: z.array(z.string().uuid()).min(1),
  })
  .strict()
  .refine((input) => new Set(input.order_ids).size === input.order_ids.length, {
    message: "Order priorities must not include duplicate order IDs",
  })

export const orderListQuerySchema = z.object({
  status: orderStatusSchema.optional(),
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type OrderLineItemProgressStage = z.infer<typeof orderLineItemProgressStageSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
export type UpdateOrderPrioritiesInput = z.infer<typeof updateOrderPrioritiesSchema>
export type OrderListQuery = z.infer<typeof orderListQuerySchema>
export type CreateOrderLineItemProgressEventInput = z.infer<
  typeof createOrderLineItemProgressEventSchema
>
