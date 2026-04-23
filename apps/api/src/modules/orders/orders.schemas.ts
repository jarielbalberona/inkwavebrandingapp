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

export const orderListQuerySchema = z.object({
  status: orderStatusSchema.optional(),
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type OrderLineItemProgressStage = z.infer<typeof orderLineItemProgressStageSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
export type OrderListQuery = z.infer<typeof orderListQuerySchema>
export type CreateOrderLineItemProgressEventInput = z.infer<
  typeof createOrderLineItemProgressEventSchema
>
