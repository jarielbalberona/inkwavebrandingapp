import type { UserRole } from "../users/users.schemas.js"

export const permissionDefinitions = [
  {
    key: "dashboard.view",
    label: "View dashboard",
    description: "Open the operational dashboard summary.",
    group: "dashboard",
  },
  {
    key: "users.manage",
    label: "Manage users",
    description: "Create staff accounts and update assigned permissions.",
    group: "administration",
  },
  {
    key: "customers.view",
    label: "View customers",
    description: "Open the customer list and customer detail screens.",
    group: "customers",
  },
  {
    key: "customers.manage",
    label: "Manage customers",
    description: "Create and update customer records.",
    group: "customers",
  },
  {
    key: "customers.confidential.view",
    label: "View customer confidential fields",
    description: "See contact details, addresses, email, and notes.",
    group: "customers",
  },
  {
    key: "cups.view",
    label: "View cups",
    description: "Open cup catalog records.",
    group: "catalog",
  },
  {
    key: "catalog.pricing.view",
    label: "View catalog pricing",
    description: "See cost and default sell pricing for cups, lids, and general items.",
    group: "catalog",
  },
  {
    key: "cups.manage",
    label: "Manage cups",
    description: "Create and update cup catalog records.",
    group: "catalog",
  },
  {
    key: "lids.view",
    label: "View lids",
    description: "Open lid catalog records.",
    group: "catalog",
  },
  {
    key: "lids.manage",
    label: "Manage lids",
    description: "Create and update lid catalog records.",
    group: "catalog",
  },
  {
    key: "non_stock_items.view",
    label: "View general items",
    description: "Open non-stock item records.",
    group: "catalog",
  },
  {
    key: "non_stock_items.manage",
    label: "Manage general items",
    description: "Create and update non-stock item records.",
    group: "catalog",
  },
  {
    key: "product_bundles.view",
    label: "View product bundles",
    description: "Open commercial product bundle records.",
    group: "catalog",
  },
  {
    key: "product_bundles.manage",
    label: "Manage product bundles",
    description: "Create and update commercial product bundle records.",
    group: "catalog",
  },
  {
    key: "inventory.view",
    label: "View inventory",
    description: "Open inventory balances and movement history.",
    group: "inventory",
  },
  {
    key: "inventory.stock_intake",
    label: "Record stock intake",
    description: "Append stock_in movements to tracked inventory items.",
    group: "inventory",
  },
  {
    key: "inventory.adjust",
    label: "Record inventory adjustments",
    description: "Append adjustment_in and adjustment_out movements.",
    group: "inventory",
  },
  {
    key: "orders.view",
    label: "View orders",
    description: "Open order lists, order details, and fulfillment progress.",
    group: "orders",
  },
  {
    key: "orders.manage",
    label: "Manage orders",
    description: "Create, edit, cancel, and reprioritize orders.",
    group: "orders",
  },
  {
    key: "orders.fulfillment.record",
    label: "Record order fulfillment",
    description: "Record fulfillment progress events on order line items.",
    group: "orders",
  },
  {
    key: "orders.custom_charges.manage",
    label: "Manage custom charges on orders",
    description: "Create and edit custom charge line items on orders.",
    group: "orders",
  },
  {
    key: "orders.pricing.view",
    label: "View order pricing",
    description: "See unit pricing on order line items.",
    group: "orders",
  },
  {
    key: "invoices.view",
    label: "View invoices",
    description: "Open invoice lists, invoice details, and invoice PDFs.",
    group: "invoices",
  },
  {
    key: "invoices.manage",
    label: "Manage invoices",
    description: "View, generate, and share invoices.",
    group: "invoices",
  },
  {
    key: "reports.view",
    label: "View reports",
    description: "Open operational reports.",
    group: "reports",
  },
  {
    key: "reports.financial.view",
    label: "View financial reports",
    description: "See sales and cost reporting surfaces.",
    group: "reports",
  },
] as const

export type AppPermission = (typeof permissionDefinitions)[number]["key"]
export type PermissionDefinition = (typeof permissionDefinitions)[number]

export const permissionKeys = permissionDefinitions.map((permission) => permission.key) as [
  AppPermission,
  ...AppPermission[],
]

const permissionKeySet = new Set<AppPermission>(permissionKeys)

export const rolePermissionPresets: Record<UserRole, readonly AppPermission[]> = {
  admin: permissionKeys,
  staff: [],
}

export function isPermission(value: unknown): value is AppPermission {
  return typeof value === "string" && permissionKeySet.has(value as AppPermission)
}

export function normalizeAssignedPermissions(
  permissions: readonly string[] | null | undefined,
): AppPermission[] {
  if (!permissions?.length) {
    return []
  }

  const assigned = new Set<AppPermission>()

  for (const permission of permissions) {
    if (!isPermission(permission)) {
      continue
    }

    assigned.add(permission)
  }

  return permissionKeys.filter((permission) => assigned.has(permission))
}

export function resolveEffectivePermissions(
  role: UserRole,
  assignedPermissions: readonly string[] | null | undefined = [],
): AppPermission[] {
  const effective = new Set<AppPermission>(rolePermissionPresets[role])

  for (const permission of normalizeAssignedPermissions(assignedPermissions)) {
    effective.add(permission)
  }

  if (effective.has("customers.manage")) {
    effective.add("customers.view")
  }

  if (effective.has("customers.manage")) {
    effective.add("customers.confidential.view")
  }

  if (effective.has("cups.manage")) {
    effective.add("cups.view")
  }

  if (effective.has("lids.manage")) {
    effective.add("lids.view")
  }

  if (effective.has("non_stock_items.manage")) {
    effective.add("non_stock_items.view")
  }

  if (effective.has("product_bundles.manage")) {
    effective.add("product_bundles.view")
  }

  if (
    effective.has("cups.manage") ||
    effective.has("lids.manage") ||
    effective.has("non_stock_items.manage") ||
    effective.has("product_bundles.manage")
  ) {
    effective.add("catalog.pricing.view")
  }

  if (effective.has("inventory.stock_intake") || effective.has("inventory.adjust")) {
    effective.add("inventory.view")
  }

  if (effective.has("orders.custom_charges.manage")) {
    effective.add("orders.view")
  }

  if (effective.has("orders.manage")) {
    effective.add("orders.view")
  }

  if (effective.has("orders.fulfillment.record")) {
    effective.add("orders.view")
  }

  if (effective.has("orders.manage")) {
    effective.add("orders.fulfillment.record")
  }

  if (effective.has("orders.custom_charges.manage")) {
    effective.add("orders.pricing.view")
  }

  if (effective.has("invoices.manage")) {
    effective.add("invoices.view")
  }

  if (effective.has("reports.financial.view")) {
    effective.add("reports.view")
  }

  return permissionKeys.filter((permission) => effective.has(permission))
}

export function hasPermission(
  user: { permissions?: readonly string[] | null; role?: UserRole | null } | null | undefined,
  permission: AppPermission,
): boolean {
  if (!user) {
    return false
  }

  if (user.permissions?.includes(permission)) {
    return true
  }

  if (!user.role) {
    return false
  }

  return rolePermissionPresets[user.role].includes(permission)
}

export function listPermissionDefinitions(): readonly PermissionDefinition[] {
  return permissionDefinitions
}
