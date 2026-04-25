export const appPermissions = {
  dashboardView: "dashboard.view",
  usersManage: "users.manage",
  customersView: "customers.view",
  customersManage: "customers.manage",
  customersConfidentialView: "customers.confidential.view",
  cupsView: "cups.view",
  catalogPricingView: "catalog.pricing.view",
  cupsManage: "cups.manage",
  lidsView: "lids.view",
  lidsManage: "lids.manage",
  nonStockItemsView: "non_stock_items.view",
  nonStockItemsManage: "non_stock_items.manage",
  productBundlesView: "product_bundles.view",
  productBundlesManage: "product_bundles.manage",
  sellableProductPriceRulesView: "sellable_product_price_rules.view",
  sellableProductPriceRulesManage: "sellable_product_price_rules.manage",
  inventoryView: "inventory.view",
  inventoryStockIntake: "inventory.stock_intake",
  inventoryAdjust: "inventory.adjust",
  ordersView: "orders.view",
  ordersManage: "orders.manage",
  ordersFulfillmentRecord: "orders.fulfillment.record",
  ordersCustomChargesManage: "orders.custom_charges.manage",
  ordersPricingView: "orders.pricing.view",
  invoicesView: "invoices.view",
  invoicesManage: "invoices.manage",
  reportsView: "reports.view",
  reportsFinancialView: "reports.financial.view",
} as const

export type AppPermission = (typeof appPermissions)[keyof typeof appPermissions]
type PermissionUser =
  | { permissions?: readonly string[] | null; role?: "admin" | "staff" | null }
  | null
  | undefined

const productViewPermissions = [
  appPermissions.cupsView,
  appPermissions.lidsView,
  appPermissions.nonStockItemsView,
  appPermissions.productBundlesView,
  appPermissions.sellableProductPriceRulesView,
] as const

export function hasPermission(
  user: PermissionUser,
  permission: AppPermission,
): boolean {
  if (user?.role === "admin") {
    return true
  }

  return Boolean(user?.permissions?.includes(permission))
}

export function hasAnyPermission(
  user: PermissionUser,
  permissions: readonly AppPermission[],
): boolean {
  return permissions.some((permission) => hasPermission(user, permission))
}

export function canViewProducts(user: PermissionUser): boolean {
  return hasAnyPermission(user, productViewPermissions)
}

export function getDefaultAuthorizedRoute(user: PermissionUser): string | null {
  if (hasPermission(user, appPermissions.dashboardView)) {
    return "/dashboard"
  }

  if (canViewProducts(user)) {
    return "/products"
  }

  if (hasPermission(user, appPermissions.customersView)) {
    return "/customers"
  }

  if (hasPermission(user, appPermissions.inventoryView)) {
    return "/inventory"
  }

  if (hasPermission(user, appPermissions.ordersView)) {
    return "/orders"
  }

  if (hasPermission(user, appPermissions.invoicesView)) {
    return "/invoices"
  }

  if (hasPermission(user, appPermissions.reportsView)) {
    return "/reports"
  }

  if (hasPermission(user, appPermissions.usersManage)) {
    return "/users"
  }

  return null
}
