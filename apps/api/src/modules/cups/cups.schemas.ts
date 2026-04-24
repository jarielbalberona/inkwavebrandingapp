import { z } from "zod"

import {
  addCupContractIssues,
  cupBrandSchema,
  cupColorSchema,
  cupDiameterSchema,
  cupSizeSchema,
  cupTypeSchema,
} from "./cups.contract.js"

export const cupMoneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a non-negative money amount with up to 2 decimals")

const baseCupSchema = z.object({
  type: cupTypeSchema,
  brand: cupBrandSchema,
  diameter: cupDiameterSchema,
  size: cupSizeSchema,
  color: cupColorSchema,
  minStock: z.number().int().nonnegative().default(0),
  costPrice: cupMoneySchema.default("0"),
  defaultSellPrice: cupMoneySchema,
  isActive: z.boolean().default(true),
})

export const createCupSchema = baseCupSchema.superRefine((input, context) => {
  addCupContractIssues(input, context)
})

export const updateCupSchema = baseCupSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one cup field is required")
  .superRefine((input, context) => {
    if (
      input.type === undefined ||
      input.brand === undefined ||
      input.diameter === undefined ||
      input.size === undefined ||
      input.color === undefined
    ) {
      return
    }

    addCupContractIssues(
      {
        type: input.type,
        brand: input.brand,
        diameter: input.diameter,
        size: input.size,
        color: input.color,
      },
      context,
    )
  })

export const cupIdSchema = z.string().uuid()

export const cupListQuerySchema = z.object({
  include_inactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sku: z.string().trim().min(1).max(80).optional(),
})

export const createCupRequestSchema = z
  .object({
    type: baseCupSchema.shape.type,
    brand: baseCupSchema.shape.brand,
    diameter: baseCupSchema.shape.diameter,
    size: baseCupSchema.shape.size,
    color: baseCupSchema.shape.color,
    min_stock: baseCupSchema.shape.minStock,
    cost_price: baseCupSchema.shape.costPrice,
    default_sell_price: baseCupSchema.shape.defaultSellPrice,
    is_active: baseCupSchema.shape.isActive,
  })
  .transform((input) =>
    createCupSchema.parse({
      type: input.type,
      brand: input.brand,
      diameter: input.diameter,
      size: input.size,
      color: input.color,
      minStock: input.min_stock,
      costPrice: input.cost_price,
      defaultSellPrice: input.default_sell_price,
      isActive: input.is_active,
    }),
  )

export const updateCupRequestSchema = createCupRequestSchema
  .innerType()
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one cup field is required")
  .transform((input) =>
    updateCupSchema.parse({
      type: input.type,
      brand: input.brand,
      diameter: input.diameter,
      size: input.size,
      color: input.color,
      minStock: input.min_stock,
      costPrice: input.cost_price,
      defaultSellPrice: input.default_sell_price,
      isActive: input.is_active,
    }),
  )

export type CreateCupInput = z.infer<typeof createCupSchema>
export type UpdateCupInput = z.infer<typeof updateCupSchema>
export type CupListQuery = z.infer<typeof cupListQuerySchema>
