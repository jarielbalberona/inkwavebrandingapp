import type { IncomingMessage, ServerResponse } from "node:http"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { assertPermission, AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import { UsersRepository } from "../users/users.repository.js"
import { DashboardRepository } from "./dashboard.repository.js"
import { DashboardService } from "./dashboard.service.js"

interface DashboardRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleDashboardRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: DashboardRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/dashboard/summary" && request.method === "GET") {
    try {
      const authContext = await requireAuthenticatedRequest(request, response, {
        createAuthService: () => new AuthService(new UsersRepository(getDatabaseClient())),
        env: context.env,
      })

      if (!authContext) {
        return true
      }

      assertPermission(authContext.user, "dashboard.view")

      const service = new DashboardService(new DashboardRepository(getDatabaseClient()))
      sendJson(response, 200, { summary: await service.getSummary() })
      return true
    } catch (error) {
      if (error instanceof AuthorizationError) {
        sendForbidden(response, error)
        return true
      }

      throw error
    }
  }

  return false
}
