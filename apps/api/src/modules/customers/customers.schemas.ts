import { z } from "zod"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value))

export const customerIdSchema = z.string().uuid()

export const customerCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Z0-9][A-Z0-9_-]{0,79}$/, "Customer code must use letters, numbers, hyphens, or underscores")
  .transform((value) => value.toUpperCase())

export const customerEmailSchema = z.string().trim().email().max(320).transform((value) => value.toLowerCase())

export const createCustomerSchema = z.object({
  customerCode: customerCodeSchema.optional(),
  businessName: z.string().trim().min(1).max(160),
  contactPerson: optionalText(160),
  contactNumber: optionalText(40),
  email: customerEmailSchema.optional(),
  address: optionalText(500),
  notes: optionalText(500),
  isActive: z.boolean().default(true),
})

export const updateCustomerSchema = createCustomerSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one customer field is required",
)

export const customerListQuerySchema = z.object({
  include_inactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  search: z.string().trim().min(1).max(160).optional(),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>
