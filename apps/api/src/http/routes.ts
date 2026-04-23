import type { IncomingMessage } from "node:http"

export type HttpMethod = "GET" | "POST"

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
  { access: "protected", method: "GET", path: "/cups" },
  { access: "protected", method: "POST", path: "/cups" },
] as const satisfies readonly RouteDefinition[]

export function getRequestPath(request: IncomingMessage): string {
  return new URL(request.url ?? "/", "http://localhost").pathname
}

export function isPublicRoute(method: string | undefined, path: string): boolean {
  return routeDefinitions.some(
    (route) => route.access === "public" && route.method === method && route.path === path,
  )
}
