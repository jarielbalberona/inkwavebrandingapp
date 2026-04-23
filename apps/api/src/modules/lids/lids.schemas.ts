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
  defaultSellPrice: lidMoneySchema.default("0"),
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

export type CreateLidInput = z.infer<typeof createLidSchema>
export type UpdateLidInput = z.infer<typeof updateLidSchema>
export type LidListQuery = z.infer<typeof lidListQuerySchema>
