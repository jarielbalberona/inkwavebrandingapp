import { z } from "zod"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value))

const nullableUuid = z.string().uuid().nullable().optional()

const baseProductBundleObjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(180),
  description: optionalText(800),
  cupId: nullableUuid,
  lidId: nullableUuid,
  cupQtyPerSet: z.number().int().min(0).default(0),
  lidQtyPerSet: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

const baseProductBundleSchema = baseProductBundleObjectSchema.superRefine(
  addProductBundleCompositionIssues,
)

export const createProductBundleSchema = baseProductBundleSchema

export const updateProductBundleSchema = baseProductBundleObjectSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one product bundle field is required")

export const productBundleIdSchema = z.string().uuid()

export const productBundleListQuerySchema = z.object({
  include_inactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  name: z.string().trim().min(1).max(180).optional(),
})

const createProductBundleRequestObjectSchema = z.object({
  name: baseProductBundleObjectSchema.shape.name,
  description: z.string().trim().max(800).optional(),
  cup_id: nullableUuid,
  lid_id: nullableUuid,
  cup_qty_per_set: z.number().int().min(0).default(0),
  lid_qty_per_set: z.number().int().min(0).default(0),
  is_active: baseProductBundleObjectSchema.shape.isActive,
})

export const createProductBundleRequestSchema = createProductBundleRequestObjectSchema.transform(
  (input) =>
    createProductBundleSchema.parse({
      name: input.name,
      description: input.description,
      cupId: input.cup_id,
      lidId: input.lid_id,
      cupQtyPerSet: input.cup_qty_per_set,
      lidQtyPerSet: input.lid_qty_per_set,
      isActive: input.is_active,
    }),
)

export const updateProductBundleRequestSchema = createProductBundleRequestObjectSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one product bundle field is required")
  .transform((input) => {
    const mapped: Record<string, unknown> = {}

    if ("name" in input) mapped.name = input.name
    if ("description" in input) mapped.description = input.description
    if ("cup_id" in input) mapped.cupId = input.cup_id
    if ("lid_id" in input) mapped.lidId = input.lid_id
    if ("cup_qty_per_set" in input) mapped.cupQtyPerSet = input.cup_qty_per_set
    if ("lid_qty_per_set" in input) mapped.lidQtyPerSet = input.lid_qty_per_set
    if ("is_active" in input) mapped.isActive = input.is_active

    return updateProductBundleSchema.parse(mapped)
  })

export type CreateProductBundleInput = z.infer<typeof createProductBundleSchema>
export type UpdateProductBundleInput = z.infer<typeof updateProductBundleSchema>
export type ProductBundleListQuery = z.infer<typeof productBundleListQuerySchema>

function addProductBundleCompositionIssues(
  input: {
    cupId?: string | null
    lidId?: string | null
    cupQtyPerSet: number
    lidQtyPerSet: number
  },
  context: z.RefinementCtx,
) {
  if (!input.cupId && !input.lidId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cup_id"],
      message: "At least one cup or lid component is required.",
    })
  }

  if (!input.cupId && input.cupQtyPerSet !== 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cup_qty_per_set"],
      message: "Cup quantity must be 0 when no cup is selected.",
    })
  }

  if (input.cupId && input.cupQtyPerSet <= 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cup_qty_per_set"],
      message: "Cup quantity must be greater than 0 when a cup is selected.",
    })
  }

  if (!input.lidId && input.lidQtyPerSet !== 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lid_qty_per_set"],
      message: "Lid quantity must be 0 when no lid is selected.",
    })
  }

  if (input.lidId && input.lidQtyPerSet <= 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lid_qty_per_set"],
      message: "Lid quantity must be greater than 0 when a lid is selected.",
    })
  }
}
