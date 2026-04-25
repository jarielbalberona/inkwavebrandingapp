import { z } from "zod"

export const sellableProductPriceRuleMoneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a non-negative money amount with up to 2 decimals")

const nullablePositiveInteger = z.number().int().positive().nullable().optional()

const baseSellableProductPriceRuleObjectSchema = z.object({
  productBundleId: z.string().uuid(),
  minQty: z.number().int().positive(),
  maxQty: nullablePositiveInteger,
  unitPrice: sellableProductPriceRuleMoneySchema,
  isActive: z.boolean().default(true),
})

const baseSellableProductPriceRuleSchema = baseSellableProductPriceRuleObjectSchema.superRefine(
  addQuantityRangeIssues,
)

export const createSellableProductPriceRuleSchema = baseSellableProductPriceRuleSchema

export const updateSellableProductPriceRuleSchema = baseSellableProductPriceRuleObjectSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one sellable product price rule field is required",
  )
  .superRefine((input, context) => {
    if (input.minQty === undefined || input.maxQty === undefined) {
      return
    }

    addQuantityRangeIssues(
      {
        minQty: input.minQty,
        maxQty: input.maxQty,
      },
      context,
    )
  })

export const sellableProductPriceRuleIdSchema = z.string().uuid()

export const sellableProductPriceRuleListQuerySchema = z.object({
  product_bundle_id: z.string().uuid().optional(),
  include_inactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
})

const createSellableProductPriceRuleRequestObjectSchema = z.object({
  product_bundle_id: baseSellableProductPriceRuleObjectSchema.shape.productBundleId,
  min_qty: baseSellableProductPriceRuleObjectSchema.shape.minQty,
  max_qty: nullablePositiveInteger,
  unit_price: baseSellableProductPriceRuleObjectSchema.shape.unitPrice,
  is_active: baseSellableProductPriceRuleObjectSchema.shape.isActive,
})

export const createSellableProductPriceRuleRequestSchema =
  createSellableProductPriceRuleRequestObjectSchema.transform((input) =>
    createSellableProductPriceRuleSchema.parse({
      productBundleId: input.product_bundle_id,
      minQty: input.min_qty,
      maxQty: input.max_qty,
      unitPrice: input.unit_price,
      isActive: input.is_active,
    }),
  )

export const updateSellableProductPriceRuleRequestSchema =
  createSellableProductPriceRuleRequestObjectSchema
    .partial()
    .refine(
      (value) => Object.keys(value).length > 0,
      "At least one sellable product price rule field is required",
    )
    .transform((input) => {
      const mapped: Record<string, unknown> = {}

      if ("product_bundle_id" in input) mapped.productBundleId = input.product_bundle_id
      if ("min_qty" in input) mapped.minQty = input.min_qty
      if ("max_qty" in input) mapped.maxQty = input.max_qty
      if ("unit_price" in input) mapped.unitPrice = input.unit_price
      if ("is_active" in input) mapped.isActive = input.is_active

      return updateSellableProductPriceRuleSchema.parse(mapped)
    })

export type CreateSellableProductPriceRuleInput = z.infer<
  typeof createSellableProductPriceRuleSchema
>
export type UpdateSellableProductPriceRuleInput = z.infer<
  typeof updateSellableProductPriceRuleSchema
>
export type SellableProductPriceRuleListQuery = z.infer<
  typeof sellableProductPriceRuleListQuerySchema
>

function addQuantityRangeIssues(
  input: {
    minQty: number
    maxQty?: number | null
  },
  context: z.RefinementCtx,
) {
  if (input.maxQty !== null && input.maxQty !== undefined && input.maxQty < input.minQty) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["max_qty"],
      message: "Maximum quantity must be greater than or equal to minimum quantity.",
    })
  }
}
