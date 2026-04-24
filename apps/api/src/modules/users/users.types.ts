import type { User } from "../../db/schema/index.js"
import { resolveEffectivePermissions, type PermissionDefinition } from "../auth/permissions.js"

export interface UserDto {
  id: string
  email: string
  display_name: string | null
  role: User["role"]
  permissions: string[]
  effective_permissions: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UsersListDto {
  users: UserDto[]
  permission_catalog: readonly PermissionDefinition[]
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    role: user.role,
    permissions: [...user.permissions],
    effective_permissions: resolveEffectivePermissions(user.role, user.permissions),
    is_active: user.isActive,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  }
}
