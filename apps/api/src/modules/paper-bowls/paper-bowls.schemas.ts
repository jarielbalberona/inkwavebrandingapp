import { z } from "zod"

import { paperBowlColorSchema, paperBowlSizeSchema } from "./paper-bowls.contract.js"

const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a non-negative money amount with up to 2 decimals")

const basePaperBowlSchema = z.object({
  size: paperBowlSizeSchema,
  color: paperBowlColorSchema,
  diameterMm: z.number().int().positive().nullable().default(null),
  minStock: z.number().int().nonnegative().default(0),
  costPrice: moneySchema.default("0"),
  defaultSellPrice: moneySchema,
  isActive: z.boolean().default(true),
})

export const createPaperBowlSchema = basePaperBowlSchema
export const updatePaperBowlSchema = basePaperBowlSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one paper bowl field is required")

export const paperBowlIdSchema = z.string().uuid()
export const paperBowlListQuerySchema = z.object({
  include_inactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
})

export const createPaperBowlRequestSchema = z
  .object({
    size: basePaperBowlSchema.shape.size,
    color: basePaperBowlSchema.shape.color,
    diameter_mm: basePaperBowlSchema.shape.diameterMm,
    min_stock: basePaperBowlSchema.shape.minStock,
    cost_price: basePaperBowlSchema.shape.costPrice,
    default_sell_price: basePaperBowlSchema.shape.defaultSellPrice,
    is_active: basePaperBowlSchema.shape.isActive,
  })
  .transform((input) =>
    createPaperBowlSchema.parse({
      size: input.size,
      color: input.color,
      diameterMm: input.diameter_mm,
      minStock: input.min_stock,
      costPrice: input.cost_price,
      defaultSellPrice: input.default_sell_price,
      isActive: input.is_active,
    }),
  )

export const updatePaperBowlRequestSchema = createPaperBowlRequestSchema
  .innerType()
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one paper bowl field is required")
  .transform((input) =>
    updatePaperBowlSchema.parse({
      size: input.size,
      color: input.color,
      diameterMm: input.diameter_mm,
      minStock: input.min_stock,
      costPrice: input.cost_price,
      defaultSellPrice: input.default_sell_price,
      isActive: input.is_active,
    }),
  )

export type CreatePaperBowlInput = z.infer<typeof createPaperBowlSchema>
export type UpdatePaperBowlInput = z.infer<typeof updatePaperBowlSchema>
export type PaperBowlListQuery = z.infer<typeof paperBowlListQuerySchema>
