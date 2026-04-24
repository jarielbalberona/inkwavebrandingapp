import { z } from "zod"

import { permissionKeys } from "../auth/permissions.js"

export const userRoleSchema = z.enum(["admin", "staff"])
export const appPermissionSchema = z.enum(permissionKeys)

export const userEmailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase())

export const bootstrapAdminSchema = z.object({
  email: userEmailSchema,
  password: z.string().min(12, "Admin password must be at least 12 characters"),
  displayName: z.string().trim().min(1).max(160).optional(),
})

export const createUserSchema = z.object({
  email: userEmailSchema,
  password: z.string().min(12, "Password must be at least 12 characters"),
  displayName: z.string().trim().min(1).max(160).optional(),
  role: z.literal("staff"),
  permissions: z.array(appPermissionSchema).default([]),
})

export const updateUserPermissionsSchema = z.object({
  permissions: z.array(appPermissionSchema),
})

export type UserRole = z.infer<typeof userRoleSchema>
export type AppPermissionInput = z.infer<typeof appPermissionSchema>
export type BootstrapAdminInput = z.infer<typeof bootstrapAdminSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserPermissionsInput = z.infer<typeof updateUserPermissionsSchema>
