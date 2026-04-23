import type { SafeUser } from "./auth.schemas.js"
import { canViewConfidentialFields } from "./authorization.js"

export const staffRestrictedResponseKeys = [
  "customer_info",
  "customer_name",
  "customer_email",
  "customer_phone",
  "customer_address",
  "customer_contact",
  "customerInfo",
  "customerName",
  "customerEmail",
  "customerPhone",
  "customerAddress",
  "customerContact",
  "cost_price",
  "costPrice",
  "sell_price",
  "sellPrice",
  "default_sell_price",
  "defaultSellPrice",
  "price",
  "pricing",
  "total",
  "totals",
  "order_total",
  "orderTotal",
  "cost",
  "margin",
  "profit",
] as const

export type StaffRestrictedResponseKey = (typeof staffRestrictedResponseKeys)[number]

const restrictedKeySet = new Set<string>(staffRestrictedResponseKeys)

export function shapeRoleAwareResponse<TAdmin, TStaff>(
  user: Pick<SafeUser, "role">,
  shapes: {
    admin: () => TAdmin
    staff: () => TStaff
  },
): TAdmin | TStaff {
  return canViewConfidentialFields(user) ? shapes.admin() : shapes.staff()
}

export function assertNoStaffRestrictedKeys(payload: unknown) {
  const leakedKeys = findStaffRestrictedKeys(payload)

  if (leakedKeys.length > 0) {
    throw new Error(`Staff response includes restricted field(s): ${leakedKeys.join(", ")}`)
  }
}

export function findStaffRestrictedKeys(payload: unknown): string[] {
  const leakedKeys = new Set<string>()

  visit(payload, leakedKeys)

  return [...leakedKeys].sort()
}

function visit(value: unknown, leakedKeys: Set<string>) {
  if (!value || typeof value !== "object") {
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, leakedKeys)
    }
    return
  }

  for (const [key, child] of Object.entries(value)) {
    if (restrictedKeySet.has(key)) {
      leakedKeys.add(key)
    }

    visit(child, leakedKeys)
  }
}
