import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { getRequestPath } from "../../http/routes.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import { UsersRepository } from "../users/users.repository.js"
import { NonStockItemsRepository } from "./non-stock-items.repository.js"
import {
  createNonStockItemRequestSchema,
  nonStockItemIdSchema,
  nonStockItemListQuerySchema,
  updateNonStockItemRequestSchema,
} from "./non-stock-items.schemas.js"
import {
  DuplicateNonStockItemNameError,
  NonStockItemNotFoundError,
  NonStockItemPersistenceValidationError,
  NonStockItemsService,
} from "./non-stock-items.service.js"

interface NonStockItemsRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleNonStockItemsRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: NonStockItemsRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/non-stock-items" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = nonStockItemListQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, { non_stock_items: await service.list(query, user) })
    })
    return true
  }

  if (path === "/non-stock-items" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createNonStockItemRequestSchema.parse(await readJsonBody(request))

      sendJson(response, 201, { non_stock_item: await service.create(input, user) })
    })
    return true
  }

  const idMatch = path.match(/^\/non-stock-items\/([^/]+)$/)

  if (idMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        non_stock_item: await service.getById(nonStockItemIdSchema.parse(idMatch[1]), user),
      })
    })
    return true
  }

  if (idMatch && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = updateNonStockItemRequestSchema.parse(await readJsonBody(request))

      sendJson(response, 200, {
        non_stock_item: await service.update(nonStockItemIdSchema.parse(idMatch[1]), input, user),
      })
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: NonStockItemsRouteContext,
  handler: (
    service: NonStockItemsService,
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

    await handler(
      new NonStockItemsService(new NonStockItemsRepository(getDatabaseClient())),
      authContext.user,
    )
  } catch (error) {
    handleNonStockItemsError(response, error)
  }
}

function handleNonStockItemsError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError) {
    sendJson(response, 400, {
      error: "Invalid non-stock item request",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    })
    return
  }

  if (error instanceof SyntaxError) {
    sendJson(response, 400, {
      error: "Invalid non-stock item request",
      details: [{ path: "", message: "Request body must be valid JSON." }],
    })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (
    error instanceof DuplicateNonStockItemNameError ||
    error instanceof NonStockItemNotFoundError ||
    error instanceof NonStockItemPersistenceValidationError
  ) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
