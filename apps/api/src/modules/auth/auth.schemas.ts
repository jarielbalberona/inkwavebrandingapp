import { z } from "zod"

import { userEmailSchema, userRoleSchema } from "../users/users.schemas.js"

export const loginRequestSchema = z.object({
  email: userEmailSchema,
  password: z.string().min(1),
})

export const safeUserSchema = z.object({
  id: z.string().uuid(),
  email: userEmailSchema,
  displayName: z.string().nullable(),
  role: userRoleSchema,
})

export type LoginRequest = z.infer<typeof loginRequestSchema>
export type SafeUser = z.infer<typeof safeUserSchema>
