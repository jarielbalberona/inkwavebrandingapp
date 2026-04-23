import type { IncomingMessage } from "node:http"

export type HttpMethod = "GET" | "POST" | "PATCH"

export interface RouteDefinition {
  access: "public" | "protected"
  method: HttpMethod
  path: string
}

export const routeDefinitions = [
  { access: "public", method: "GET", path: "/health" },
  { access: "public", method: "POST", path: "/auth/login" },
  { access: "public", method: "POST", path: "/auth/logout" },
  { access: "protected", method: "GET", path: "/auth/me" },
  { access: "protected", method: "GET", path: "/customers" },
  { access: "protected", method: "POST", path: "/customers" },
  { access: "protected", method: "GET", path: "/cups" },
  { access: "protected", method: "POST", path: "/cups" },
  { access: "protected", method: "GET", path: "/inventory/balances" },
  { access: "protected", method: "GET", path: "/inventory/movements" },
  { access: "protected", method: "POST", path: "/inventory/adjustments" },
  { access: "protected", method: "POST", path: "/inventory/stock-intake" },
  { access: "protected", method: "GET", path: "/dashboard/summary" },
  { access: "protected", method: "GET", path: "/order-line-items/:id/progress-events" },
  { access: "protected", method: "POST", path: "/order-line-items/:id/progress-events" },
  { access: "protected", method: "GET", path: "/orders" },
  { access: "protected", method: "GET", path: "/orders/:id" },
  { access: "protected", method: "POST", path: "/orders" },
  { access: "protected", method: "PATCH", path: "/orders/:id" },
  { access: "protected", method: "PATCH", path: "/orders/:id/cancel" },
  { access: "protected", method: "GET", path: "/reports/inventory-summary" },
  { access: "protected", method: "GET", path: "/reports/low-stock" },
  { access: "protected", method: "GET", path: "/reports/order-status" },
  { access: "protected", method: "GET", path: "/reports/cup-usage" },
  { access: "protected", method: "GET", path: "/reports/sales-cost-visibility" },
] as const satisfies readonly RouteDefinition[]

export function getRequestPath(request: IncomingMessage): string {
  return new URL(request.url ?? "/", "http://localhost").pathname
}

export function isPublicRoute(method: string | undefined, path: string): boolean {
  return routeDefinitions.some(
    (route) => route.access === "public" && route.method === method && route.path === path,
  )
}
