import { z } from "zod"

export const nonStockItemMoneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a non-negative money amount with up to 2 decimals")

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value))

const baseNonStockItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  description: optionalText(500),
  costPrice: nonStockItemMoneySchema.optional(),
  defaultSellPrice: nonStockItemMoneySchema,
  isActive: z.boolean().default(true),
})

export const createNonStockItemSchema = baseNonStockItemSchema

export const updateNonStockItemSchema = baseNonStockItemSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one non-stock item field is required")

export const nonStockItemIdSchema = z.string().uuid()

export const nonStockItemListQuerySchema = z.object({
  include_inactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  name: z.string().trim().min(1).max(160).optional(),
})

export const createNonStockItemRequestSchema = z
  .object({
    name: baseNonStockItemSchema.shape.name,
    description: z.string().trim().max(500).optional(),
    cost_price: nonStockItemMoneySchema.optional(),
    default_sell_price: baseNonStockItemSchema.shape.defaultSellPrice,
    is_active: baseNonStockItemSchema.shape.isActive,
  })
  .transform((input) =>
    createNonStockItemSchema.parse({
      name: input.name,
      description: input.description,
      costPrice: input.cost_price,
      defaultSellPrice: input.default_sell_price,
      isActive: input.is_active,
    }),
  )

export const updateNonStockItemRequestSchema = createNonStockItemRequestSchema
  .innerType()
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one non-stock item field is required")
  .transform((input) =>
    updateNonStockItemSchema.parse({
      name: input.name,
      description: input.description,
      costPrice: input.cost_price,
      defaultSellPrice: input.default_sell_price,
      isActive: input.is_active,
    }),
  )

export type CreateNonStockItemInput = z.infer<typeof createNonStockItemSchema>
export type UpdateNonStockItemInput = z.infer<typeof updateNonStockItemSchema>
export type NonStockItemListQuery = z.infer<typeof nonStockItemListQuerySchema>
