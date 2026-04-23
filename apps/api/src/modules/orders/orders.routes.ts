import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import { CupsRepository } from "../cups/cups.repository.js"
import { CustomersRepository } from "../customers/customers.repository.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"
import {
  InventoryBalanceCupNotFoundError,
  InventoryCupInactiveError,
  InventoryReservationInsufficientStockError,
  InventoryService,
} from "../inventory/inventory.service.js"
import { UsersRepository } from "../users/users.repository.js"
import {
  createOrderLineItemProgressEventSchema,
  createOrderSchema,
  updateOrderSchema,
} from "./orders.schemas.js"
import { OrdersRepository } from "./orders.repository.js"
import {
  DuplicateOrderCupError,
  OrderClosedUpdateError,
  OrderCompletedCancellationError,
  OrderCustomerReassignmentProgressError,
  OrderCupInactiveError,
  OrderCupNotFoundError,
  OrderCustomerInactiveError,
  OrderCustomerNotFoundError,
  OrderLineItemNotFoundError,
  OrderNotFoundError,
  OrderPrintedQuantityNotReservedError,
  OrderProgressClosedError,
  OrderProgressValidationError,
  OrdersService,
} from "./orders.service.js"

interface OrdersRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleOrdersRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: OrdersRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/orders" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createOrderSchema.parse(await readJsonBody(request))

      sendJson(response, 201, { order: await service.create(input, user) })
    })
    return true
  }

  const updateOrderMatch = path.match(/^\/orders\/([^/]+)$/)

  if (updateOrderMatch && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = updateOrderSchema.parse(await readJsonBody(request))

      sendJson(response, 200, { order: await service.update(updateOrderMatch[1] ?? "", input, user) })
    })
    return true
  }

  const cancelOrderMatch = path.match(/^\/orders\/([^/]+)\/cancel$/)

  if (cancelOrderMatch && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, { order: await service.cancel(cancelOrderMatch[1] ?? "", user) })
    })
    return true
  }

  const progressEventsMatch = path.match(/^\/order-line-items\/([^/]+)\/progress-events$/)

  if (progressEventsMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service) => {
      sendJson(response, 200, await service.listProgressEvents(progressEventsMatch[1] ?? ""))
    })
    return true
  }

  if (progressEventsMatch && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createOrderLineItemProgressEventSchema.parse(await readJsonBody(request))

      sendJson(response, 201, await service.createProgressEvent(progressEventsMatch[1] ?? "", input, user))
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: OrdersRouteContext,
  handler: (
    service: OrdersService,
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

    const db = getDatabaseClient()
    await handler(
      new OrdersService(
        new OrdersRepository(db),
        new CustomersRepository(db),
        new CupsRepository(db),
        (transactionDb) =>
          new InventoryService(
            new InventoryRepository(transactionDb),
            new CupsRepository(transactionDb),
          ),
      ),
      authContext.user,
    )
  } catch (error) {
    handleOrdersError(response, error)
  }
}

function handleOrdersError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    sendJson(response, 400, { error: "Invalid order request" })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (
    error instanceof OrderCustomerNotFoundError ||
    error instanceof OrderCustomerInactiveError ||
    error instanceof OrderCupNotFoundError ||
    error instanceof OrderCupInactiveError ||
    error instanceof DuplicateOrderCupError ||
    error instanceof OrderLineItemNotFoundError ||
    error instanceof OrderNotFoundError ||
    error instanceof OrderClosedUpdateError ||
    error instanceof OrderCompletedCancellationError ||
    error instanceof OrderCustomerReassignmentProgressError ||
    error instanceof OrderPrintedQuantityNotReservedError ||
    error instanceof OrderProgressClosedError ||
    error instanceof OrderProgressValidationError ||
    error instanceof InventoryBalanceCupNotFoundError ||
    error instanceof InventoryCupInactiveError ||
    error instanceof InventoryReservationInsufficientStockError
  ) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
