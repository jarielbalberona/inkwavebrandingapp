import { z } from "zod"

const requiredText = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value))

export const cupMoneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a non-negative money amount with up to 2 decimals")

export const createCupSchema = z.object({
  sku: requiredText(80),
  brand: requiredText(160),
  size: requiredText(80),
  dimension: requiredText(120),
  material: optionalText(80),
  color: optionalText(80),
  minStock: z.number().int().nonnegative().default(0),
  costPrice: cupMoneySchema.default("0"),
  defaultSellPrice: cupMoneySchema.default("0"),
  isActive: z.boolean().default(true),
})

export const updateCupSchema = createCupSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one cup field is required",
)

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
    sku: createCupSchema.shape.sku,
    brand: createCupSchema.shape.brand,
    size: createCupSchema.shape.size,
    dimension: createCupSchema.shape.dimension,
    material: createCupSchema.shape.material,
    color: createCupSchema.shape.color,
    min_stock: createCupSchema.shape.minStock,
    cost_price: createCupSchema.shape.costPrice,
    default_sell_price: createCupSchema.shape.defaultSellPrice,
    is_active: createCupSchema.shape.isActive,
  })
  .transform((input) =>
    createCupSchema.parse({
      sku: input.sku,
      brand: input.brand,
      size: input.size,
      dimension: input.dimension,
      material: input.material,
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
      sku: input.sku,
      brand: input.brand,
      size: input.size,
      dimension: input.dimension,
      material: input.material,
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
