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
  InventoryBalanceItemNotFoundError,
  InventoryItemInactiveError,
  InventoryItemNotFoundError,
  InventoryService,
} from "../inventory/inventory.service.js"
import { LidsRepository } from "../lids/lids.repository.js"
import { NonStockItemsRepository } from "../non-stock-items/non-stock-items.repository.js"
import { UsersRepository } from "../users/users.repository.js"
import {
  InvoicePaidLockError,
  InvoicePaymentLockError,
  InvoiceVoidLockError,
} from "../invoices/invoices.service.js"
import {
  createOrderLineItemProgressEventSchema,
  createOrderSchema,
  orderListQuerySchema,
  updateOrderPrioritiesSchema,
  updateOrderSchema,
} from "./orders.schemas.js"
import { OrdersRepository } from "./orders.repository.js"
import {
  DuplicateOrderItemError,
  OrderClosedUpdateError,
  OrderCompletedCancellationError,
  OrderCreateValidationError,
  OrderCustomerReassignmentProgressError,
  OrderCupInactiveError,
  OrderCupNotFoundError,
  OrderLidInactiveError,
  OrderLidNotFoundError,
  OrderCustomerInactiveError,
  OrderCustomerNotFoundError,
  OrderLineItemNotFoundError,
  OrderLineItemProgressLockedError,
  OrderNotFoundError,
  OrderPrintedQuantityNotReservedError,
  OrderPrintedQuantityInsufficientStockError,
  OrderPriorityValidationError,
  OrderProgressClosedError,
  OrderProgressValidationError,
  OrderStructuralEditStatusError,
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

  if (path === "/orders" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = orderListQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, { orders: await service.list(query, user) })
    })
    return true
  }

  if (path === "/orders" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createOrderSchema.parse(await readJsonBody(request))

      sendJson(response, 201, { order: await service.create(input, user) })
    })
    return true
  }

  if (path === "/orders/priorities" && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = updateOrderPrioritiesSchema.parse(await readJsonBody(request))

      sendJson(response, 200, {
        orders: await service.updatePriorities(input, user),
      })
    })
    return true
  }

  const getOrderMatch = path.match(/^\/orders\/([^/]+)$/)

  if (getOrderMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, { order: await service.getById(getOrderMatch[1] ?? "", user) })
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
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, await service.listProgressEvents(progressEventsMatch[1] ?? "", user))
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
        new LidsRepository(db),
        new NonStockItemsRepository(db),
        (transactionDb) =>
          new InventoryService(
            new InventoryRepository(transactionDb),
            new CupsRepository(transactionDb),
            new LidsRepository(transactionDb),
          ),
      ),
      authContext.user,
    )
  } catch (error) {
    handleOrdersError(response, error)
  }
}

function handleOrdersError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError) {
    sendJson(response, 400, {
      error: "Invalid order request",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    })
    return
  }

  if (error instanceof SyntaxError) {
    sendJson(response, 400, {
      error: "Invalid order request",
      message: error.message,
    })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (
    error instanceof OrderCreateValidationError ||
    error instanceof OrderCustomerNotFoundError ||
    error instanceof OrderCustomerInactiveError ||
    error instanceof OrderCupNotFoundError ||
    error instanceof OrderCupInactiveError ||
    error instanceof OrderLidNotFoundError ||
    error instanceof OrderLidInactiveError ||
    error instanceof DuplicateOrderItemError ||
    error instanceof OrderLineItemNotFoundError ||
    error instanceof OrderLineItemProgressLockedError ||
    error instanceof OrderNotFoundError ||
    error instanceof OrderClosedUpdateError ||
    error instanceof OrderStructuralEditStatusError ||
    error instanceof OrderPriorityValidationError ||
    error instanceof OrderCompletedCancellationError ||
    error instanceof OrderCustomerReassignmentProgressError ||
    error instanceof OrderPrintedQuantityNotReservedError ||
    error instanceof OrderPrintedQuantityInsufficientStockError ||
    error instanceof OrderProgressClosedError ||
    error instanceof OrderProgressValidationError ||
    error instanceof InvoicePaidLockError ||
    error instanceof InvoicePaymentLockError ||
    error instanceof InvoiceVoidLockError ||
    error instanceof InventoryBalanceItemNotFoundError ||
    error instanceof InventoryItemNotFoundError ||
    error instanceof InventoryItemInactiveError
  ) {
    if (error instanceof OrderCreateValidationError) {
      sendJson(response, error.statusCode, {
        error: error.message,
        line_items: error.details.map((detail) => ({
          line_item_index: detail.lineItemIndex,
          item_type: detail.itemType,
          item_id: detail.itemId,
          field: detail.field,
          item_label: detail.itemLabel,
          requested_quantity: detail.requestedQuantity,
          available_quantity: detail.availableQuantity,
          message: detail.message,
        })),
      })
      return
    }

    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
