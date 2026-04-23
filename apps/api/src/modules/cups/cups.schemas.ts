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

export type CreateCupInput = z.infer<typeof createCupSchema>
export type UpdateCupInput = z.infer<typeof updateCupSchema>
