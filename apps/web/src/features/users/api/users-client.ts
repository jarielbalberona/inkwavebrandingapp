import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

const permissionDefinitionSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  group: z.string(),
})

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().nullable(),
  role: z.enum(["admin", "staff"]),
  permissions: z.array(z.string()),
  effective_permissions: z.array(z.string()),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const usersResponseSchema = z.object({
  users: z.array(userSchema),
  permission_catalog: z.array(permissionDefinitionSchema),
})

const userResponseSchema = z.object({
  user: userSchema,
})

export type User = z.infer<typeof userSchema>
export type PermissionDefinition = z.infer<typeof permissionDefinitionSchema>
export type UsersResponse = z.infer<typeof usersResponseSchema>

export interface CreateUserPayload {
  email: string
  displayName?: string
  password: string
  role: "staff"
  permissions: string[]
}

export interface UpdateUserPermissionsPayload {
  permissions: string[]
}

export class UsersApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function listUsers(): Promise<UsersResponse> {
  try {
    const response = await api.get<unknown>("/users")
    return usersResponseSchema.parse(response)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 403) {
      throw new UsersApiError("You do not have permission to manage user accounts.", error.status)
    }

    if (error instanceof ApiClientError) {
      throw new UsersApiError("Unable to load users.", error.status)
    }

    throw error
  }
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  try {
    const response = await api.post<unknown, typeof payload>("/users", payload)
    return userResponseSchema.parse(response).user
  } catch (error) {
    throw mapUsersApiError(error, "create")
  }
}

export async function updateUserPermissions(
  id: string,
  payload: UpdateUserPermissionsPayload,
): Promise<User> {
  try {
    const response = await api.patch<unknown, typeof payload>(`/users/${id}/permissions`, payload)
    return userResponseSchema.parse(response).user
  } catch (error) {
    throw mapUsersApiError(error, "update")
  }
}

function mapUsersApiError(error: unknown, action: "create" | "update"): Error {
  if (error instanceof ApiClientError && error.status === 400) {
    return new UsersApiError("Check the user permission fields and try again.", error.status)
  }

  if (error instanceof ApiClientError && error.status === 403) {
    return new UsersApiError("You do not have permission to manage user accounts.", error.status)
  }

  if (error instanceof ApiClientError && error.status === 404) {
    return new UsersApiError("User no longer exists.", error.status)
  }

  if (error instanceof ApiClientError && error.status === 409) {
    return new UsersApiError(
      action === "create"
        ? "That email is already in use."
        : error.message || "This user cannot receive that permission update.",
      error.status,
    )
  }

  if (error instanceof ApiClientError) {
    return new UsersApiError(
      action === "create" ? "Unable to create user." : "Unable to update user permissions.",
      error.status,
    )
  }

  return error instanceof Error ? error : new Error("Unknown user API error")
}
