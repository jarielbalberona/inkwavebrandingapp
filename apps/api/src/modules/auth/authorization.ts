import type { ServerResponse } from "node:http"

import { sendJson } from "../../http/json.js"
import {
  type AppPermission,
  hasPermission,
  permissionDefinitions,
} from "./permissions.js"
import type { UserRole } from "../users/users.schemas.js"
import type { SafeUser } from "./auth.schemas.js"

export const confidentialFieldCategories = [
  "customer_info",
  "pricing",
  "order_totals",
  "cost",
  "margin",
  "profit",
] as const

export type ConfidentialFieldCategory = (typeof confidentialFieldCategories)[number]

export class AuthorizationError extends Error {
  readonly statusCode = 403

  constructor(message = "Forbidden") {
    super(message)
  }
}

export function isAdmin(user: Pick<SafeUser, "role">): boolean {
  return user.role === "admin"
}

export function canViewConfidentialFields(user: Pick<SafeUser, "role" | "permissions">): boolean {
  return (
    hasPermission(user, "customers.confidential.view") ||
    hasPermission(user, "catalog.pricing.view") ||
    hasPermission(user, "orders.pricing.view") ||
    hasPermission(user, "reports.financial.view") ||
    isAdmin(user)
  )
}

export function assertPermission(
  user: Pick<SafeUser, "role" | "permissions">,
  permission: AppPermission,
): void {
  if (!hasPermission(user, permission)) {
    const definition = permissionDefinitions.find((entry) => entry.key === permission)
    throw new AuthorizationError(
      definition ? `${definition.label} permission required` : "Permission required",
    )
  }
}

export function assertAdmin(user: Pick<SafeUser, "role" | "permissions">): asserts user is SafeUser & { role: "admin" } {
  assertPermission(user, "users.manage")
}

export function assertCanViewConfidentialFields(user: Pick<SafeUser, "role" | "permissions">) {
  if (!canViewConfidentialFields(user)) {
    throw new AuthorizationError("Confidential-view permission required")
  }
}

export function sendForbidden(response: ServerResponse, error: AuthorizationError = new AuthorizationError()) {
  sendJson(response, error.statusCode, { error: error.message })
}

export function roleFromUnknown(value: unknown): UserRole | null {
  return value === "admin" || value === "staff" ? value : null
}
