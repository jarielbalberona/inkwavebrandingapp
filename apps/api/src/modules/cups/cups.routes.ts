import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthService } from "../auth/auth.service.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { UsersRepository } from "../users/users.repository.js"
import { CupsRepository } from "./cups.repository.js"
import {
  createCupRequestSchema,
  cupIdSchema,
  cupListQuerySchema,
  updateCupRequestSchema,
} from "./cups.schemas.js"
import { CupNotFoundError, CupsService, DuplicateCupSkuError } from "./cups.service.js"

interface CupsRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleCupsRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: CupsRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/cups" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = cupListQuerySchema.parse(Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams))

      sendJson(response, 200, { cups: await service.list(query, user) })
    })
    return true
  }

  if (path === "/cups" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createCupRequestSchema.parse(await readJsonBody(request))

      sendJson(response, 201, { cup: await service.create(input, user) })
    })
    return true
  }

  const bySkuMatch = path.match(/^\/cups\/by-sku\/([^/]+)$/)

  if (bySkuMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        cup: await service.getBySku(decodeURIComponent(bySkuMatch[1] ?? ""), user),
      })
    })
    return true
  }

  const idMatch = path.match(/^\/cups\/([^/]+)$/)

  if (idMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        cup: await service.getById(cupIdSchema.parse(idMatch[1]), user),
      })
    })
    return true
  }

  if (idMatch && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = updateCupRequestSchema.parse(await readJsonBody(request))

      sendJson(response, 200, {
        cup: await service.update(cupIdSchema.parse(idMatch[1]), input, user),
      })
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: CupsRouteContext,
  handler: (
    service: CupsService,
    user: NonNullable<Awaited<ReturnType<AuthService["getCurrentUser"]>>>,
  ) => Promise<void>,
) {
  try {
    const authContext = await requireAuthenticatedRequest(request, response, {
      createAuthService: () => new AuthService(new UsersRepository(getDatabaseClient())),
      env: context.env,
    })

    if (!authContext) {
      return
    }

    await handler(new CupsService(new CupsRepository(getDatabaseClient())), authContext.user)
  } catch (error) {
    handleCupsError(response, error)
  }
}

function handleCupsError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    sendJson(response, 400, { error: "Invalid cup request" })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (error instanceof CupNotFoundError) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  if (error instanceof DuplicateCupSkuError) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
