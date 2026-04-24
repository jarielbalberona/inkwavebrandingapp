import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { AuthService } from "../auth/auth.service.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"
import { UsersRepository } from "../users/users.repository.js"
import { ReportsRepository } from "./reports.repository.js"
import {
  cupUsageReportQuerySchema,
  salesCostVisibilityReportQuerySchema,
} from "./reports.schemas.js"
import { ReportsService } from "./reports.service.js"

interface ReportsRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleReportsRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: ReportsRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/reports/inventory-summary" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, { report: await service.getInventorySummary(user) })
    })
    return true
  }

  if (path === "/reports/low-stock" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, { report: await service.getLowStock(user) })
    })
    return true
  }

  if (path === "/reports/order-status" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, { report: await service.getOrderStatusReport(user) })
    })
    return true
  }

  if (path === "/reports/cup-usage" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = cupUsageReportQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, { report: await service.getCupUsageReport(query, user) })
    })
    return true
  }

  if (path === "/reports/sales-cost-visibility" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = salesCostVisibilityReportQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, { report: await service.getSalesCostVisibilityReport(query, user) })
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: ReportsRouteContext,
  handler: (service: ReportsService, user: SafeUser) => Promise<void>,
) {
  try {
    const authContext = await requireAuthenticatedRequest(request, response, {
      createAuthService: () => new AuthService(new UsersRepository(getDatabaseClient())),
      env: context.env,
    })

    if (!authContext) {
      return
    }

    const db = getDatabaseClient()

    await handler(
      new ReportsService(
        new ReportsRepository(db, new InventoryRepository(db)),
      ),
      authContext.user,
    )
  } catch (error) {
    handleReportsError(response, error)
  }
}

function handleReportsError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    sendJson(response, 400, { error: "Invalid reports request" })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  throw error
}
