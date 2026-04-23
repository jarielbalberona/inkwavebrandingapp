import type { ServerResponse } from "node:http"

import { sendJson } from "../../http/json.js"
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

export function canViewConfidentialFields(user: Pick<SafeUser, "role">): boolean {
  return isAdmin(user)
}

export function assertAdmin(user: Pick<SafeUser, "role">): asserts user is SafeUser & { role: "admin" } {
  if (!isAdmin(user)) {
    throw new AuthorizationError("Admin role required")
  }
}

export function assertCanViewConfidentialFields(user: Pick<SafeUser, "role">) {
  if (!canViewConfidentialFields(user)) {
    throw new AuthorizationError("Confidential fields require admin role")
  }
}

export function sendForbidden(response: ServerResponse, error: AuthorizationError = new AuthorizationError()) {
  sendJson(response, error.statusCode, { error: error.message })
}

export function roleFromUnknown(value: unknown): UserRole | null {
  return value === "admin" || value === "staff" ? value : null
}
