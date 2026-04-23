import { z } from "zod"

export const userRoleSchema = z.enum(["admin", "staff"])

export const userEmailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase())

export const bootstrapAdminSchema = z.object({
  email: userEmailSchema,
  password: z.string().min(8, "Admin password must be at least 12 characters"),
  displayName: z.string().trim().min(1).max(160).optional(),
})

export type UserRole = z.infer<typeof userRoleSchema>
export type BootstrapAdminInput = z.infer<typeof bootstrapAdminSchema>
