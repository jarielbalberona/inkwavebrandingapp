import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import {
  AuthorizationError,
  sendForbidden,
} from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import { CupsRepository } from "../cups/cups.repository.js"
import { LidsRepository } from "../lids/lids.repository.js"
import { UsersRepository } from "../users/users.repository.js"
import {
  InventoryAdjustmentOutInsufficientStockError,
  InventoryBalanceItemNotFoundError,
  InventoryItemInactiveError,
  InventoryItemNotFoundError,
  InventoryService,
} from "./inventory.service.js"
import { InventoryRepository } from "./inventory.repository.js"
import {
  inventoryAdjustmentRequestSchema,
  inventoryBalanceQuerySchema,
  inventoryMovementsQuerySchema,
  stockIntakeRequestSchema,
} from "./inventory.schemas.js"

interface InventoryRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleInventoryRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: InventoryRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/inventory/balances" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = inventoryBalanceQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, {
        balances: await service.listBalances(query, user),
      })
    })
    return true
  }

  if (path === "/inventory/movements" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = inventoryMovementsQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, {
        movements: await service.listMovements(query, user),
      })
    })
    return true
  }

  if (path === "/inventory/adjustments" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = inventoryAdjustmentRequestSchema.parse(await readJsonBody(request))

      sendJson(response, 201, {
        movement: await service.recordAdjustment(input, user),
      })
    })
    return true
  }

  if (path === "/inventory/stock-intake" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = stockIntakeRequestSchema.parse(await readJsonBody(request))
      const movement = await service.recordStockIntake(input, user)

      sendJson(response, 201, { movement })
    })
    return true
  }

  const balanceByCupMatch = path.match(/^\/inventory\/balances\/([^/]+)$/)

  if (balanceByCupMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        balance: await service.getBalanceByCupId(balanceByCupMatch[1] ?? "", user),
      })
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: InventoryRouteContext,
  handler: (
    service: InventoryService,
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
      new InventoryService(
        new InventoryRepository(getDatabaseClient()),
        new CupsRepository(getDatabaseClient()),
        new LidsRepository(getDatabaseClient()),
      ),
      authContext.user,
    )
  } catch (error) {
    handleInventoryError(response, error)
  }
}

function handleInventoryError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    sendJson(response, 400, { error: "Invalid inventory request" })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (
    error instanceof InventoryItemNotFoundError ||
    error instanceof InventoryItemInactiveError ||
    error instanceof InventoryBalanceItemNotFoundError ||
    error instanceof InventoryAdjustmentOutInsufficientStockError
  ) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
