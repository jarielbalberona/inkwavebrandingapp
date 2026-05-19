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

const moneyStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid non-negative money amount")

const createOrderLineItemSchema = z.discriminatedUnion("item_type", [
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
    item_type: z.literal("product_bundle"),
    product_bundle_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    unit_sell_price: moneyStringSchema.optional(),
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
])

const updateOrderLineItemSchema = z.discriminatedUnion("item_type", [
  z.object({
    id: z.string().uuid().optional(),
    item_type: z.literal("cup"),
    cup_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    notes: optionalText(500),
  }),
  z.object({
    id: z.string().uuid().optional(),
    item_type: z.literal("lid"),
    lid_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    notes: optionalText(500),
  }),
  z.object({
    id: z.string().uuid().optional(),
    item_type: z.literal("non_stock_item"),
    non_stock_item_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    notes: optionalText(500),
  }),
  z.object({
    id: z.string().uuid().optional(),
    item_type: z.literal("product_bundle"),
    product_bundle_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    unit_sell_price: moneyStringSchema.optional(),
    notes: optionalText(500),
  }),
  z.object({
    id: z.string().uuid().optional(),
    item_type: z.literal("custom_charge"),
    description_snapshot: z.string().trim().min(1).max(500),
    quantity: z.number().int().positive(),
    unit_sell_price: moneyStringSchema,
    unit_cost_price: moneyStringSchema.optional(),
    notes: optionalText(500),
  }),
])

export const orderStatusSchema = z.enum([
  "quote",
  "pending",
  "in_progress",
  "ready_for_release",
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
  status: z.enum(["quote", "pending"]).optional().default("pending"),
  notes: optionalText(1000),
  internal_notes: optionalText(1000),
  line_items: z.array(createOrderLineItemSchema).min(1),
})

export const releaseMethodSchema = z.enum(["delivery", "office_pickup"])

export const createOrderLineItemProgressEventSchema = z
  .object({
    stage: orderLineItemProgressStageSchema,
    component_item_type: z.enum(["cup", "lid"]).optional(),
    quantity: z.number().int().positive(),
    release_method: releaseMethodSchema.optional(),
    staging_location: optionalText(160),
    released_to: optionalText(160),
    scheduled_release_date: z.coerce.date().optional(),
    note: optionalText(500),
    event_date: z.coerce.date(),
  })
  .superRefine((input, context) => {
    const acceptsReleaseDetails =
      input.stage === "ready_for_release" || input.stage === "released"
    const hasReleaseDetails =
      input.release_method !== undefined ||
      input.staging_location !== undefined ||
      input.released_to !== undefined ||
      input.scheduled_release_date !== undefined

    if (!acceptsReleaseDetails && hasReleaseDetails) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["release_method"],
        message:
          "Release handoff details are only allowed for ready_for_release or released events.",
      })
    }

    if (input.stage === "released" && !input.release_method) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["release_method"],
        message: "Release method is required when recording released events.",
      })
    }

    if (
      input.release_method === "office_pickup" &&
      !input.staging_location
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["staging_location"],
        message: "Staging location is required for office pickup.",
      })
    }
  })

export const progressEventsQuerySchema = z.object({
  component_item_type: z.enum(["cup", "lid"]).optional(),
})

export const updateOrderSchema = z
  .object({
    customer_id: z.string().uuid().optional(),
    notes: nullableOptionalText(1000),
    internal_notes: nullableOptionalText(1000),
    line_items: z.array(updateOrderLineItemSchema).min(1).optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.customer_id !== undefined ||
      input.notes !== undefined ||
      input.internal_notes !== undefined ||
      input.line_items !== undefined,
    {
      message: "At least one supported order field is required",
    }
  )

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
  include_archived: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type OrderLineItemProgressStage = z.infer<
  typeof orderLineItemProgressStageSchema
>
export type CreateOrderInput = z.input<typeof createOrderSchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
export type UpdateOrderPrioritiesInput = z.infer<
  typeof updateOrderPrioritiesSchema
>
export type OrderListQuery = z.input<typeof orderListQuerySchema>
export type CreateOrderLineItemProgressEventInput = z.infer<
  typeof createOrderLineItemProgressEventSchema
>
export type ProgressEventsQuery = z.infer<typeof progressEventsQuerySchema>
