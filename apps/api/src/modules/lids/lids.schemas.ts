import { z } from "zod"

import {
  addLidContractIssues,
  lidBrandSchema,
  lidColorSchema,
  lidDiameterSchema,
  lidShapeSchema,
  lidTypeSchema,
} from "./lids.contract.js"

export const lidMoneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a non-negative money amount with up to 2 decimals")

export const lidIdSchema = z.string().uuid()

const baseLidSchema = z.object({
  type: lidTypeSchema,
  brand: lidBrandSchema,
  diameter: lidDiameterSchema,
  shape: lidShapeSchema,
  color: lidColorSchema,
  costPrice: lidMoneySchema.default("0"),
  defaultSellPrice: lidMoneySchema,
  isActive: z.boolean().default(true),
})

export const createLidSchema = baseLidSchema.superRefine((input, context) => {
  addLidContractIssues(input, context)
})

export const updateLidSchema = baseLidSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one lid field is required")
  .superRefine((input, context) => {
    if (
      input.type === undefined ||
      input.brand === undefined ||
      input.diameter === undefined ||
      input.shape === undefined ||
      input.color === undefined
    ) {
      return
    }

    addLidContractIssues(
      {
        type: input.type,
        brand: input.brand,
        diameter: input.diameter,
        shape: input.shape,
        color: input.color,
      },
      context,
    )
  })

export const lidListQuerySchema = z.object({
  include_inactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
})

/** Wire body uses snake_case, matching the web client and the cups module. */
export const createLidRequestSchema = z
  .object({
    type: baseLidSchema.shape.type,
    brand: baseLidSchema.shape.brand,
    diameter: baseLidSchema.shape.diameter,
    shape: baseLidSchema.shape.shape,
    color: baseLidSchema.shape.color,
    cost_price: baseLidSchema.shape.costPrice,
    default_sell_price: baseLidSchema.shape.defaultSellPrice,
    is_active: baseLidSchema.shape.isActive,
  })
  .transform((input) =>
    createLidSchema.parse({
      type: input.type,
      brand: input.brand,
      diameter: input.diameter,
      shape: input.shape,
      color: input.color,
      costPrice: input.cost_price,
      defaultSellPrice: input.default_sell_price,
      isActive: input.is_active,
    }),
  )

export const updateLidRequestSchema = createLidRequestSchema
  .innerType()
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one lid field is required")
  .transform((input) =>
    updateLidSchema.parse({
      type: input.type,
      brand: input.brand,
      diameter: input.diameter,
      shape: input.shape,
      color: input.color,
      costPrice: input.cost_price,
      defaultSellPrice: input.default_sell_price,
      isActive: input.is_active,
    }),
  )

export type CreateLidInput = z.infer<typeof createLidSchema>
export type UpdateLidInput = z.infer<typeof updateLidSchema>
export type LidListQuery = z.infer<typeof lidListQuerySchema>
