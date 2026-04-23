import { z } from "zod"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value))

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
      z.object({
        cup_id: z.string().uuid(),
        quantity: z.number().int().positive(),
        notes: optionalText(500),
      }),
    )
    .min(1),
})

export const createOrderLineItemProgressEventSchema = z.object({
  stage: orderLineItemProgressStageSchema,
  quantity: z.number().int().positive(),
  note: optionalText(500),
  event_date: z.coerce.date(),
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type OrderLineItemProgressStage = z.infer<typeof orderLineItemProgressStageSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type CreateOrderLineItemProgressEventInput = z.infer<
  typeof createOrderLineItemProgressEventSchema
>
