import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"
import { UsersRepository } from "../users/users.repository.js"
import { ReportsRepository } from "./reports.repository.js"
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
    await withAuthenticatedUser(request, response, context, async (service) => {
      sendJson(response, 200, { report: await service.getInventorySummary() })
    })
    return true
  }

  if (path === "/reports/low-stock" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service) => {
      sendJson(response, 200, { report: await service.getLowStock() })
    })
    return true
  }

  if (path === "/reports/order-status" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service) => {
      sendJson(response, 200, { report: await service.getOrderStatusReport() })
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: ReportsRouteContext,
  handler: (service: ReportsService) => Promise<void>,
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
