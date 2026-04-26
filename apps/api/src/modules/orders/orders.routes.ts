import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { collectPostgresErrorMetadata } from "../../lib/postgres-error.js"
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
import { ProductBundlesRepository } from "../product-bundles/product-bundles.repository.js"
import { SellableProductPriceRulesRepository } from "../sellable-product-price-rules/sellable-product-price-rules.repository.js"
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
  OrderArchiveStatusError,
  OrderArchivedError,
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

  const archiveOrderMatch = path.match(/^\/orders\/([^/]+)\/archive$/)

  if (archiveOrderMatch && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, { order: await service.archive(archiveOrderMatch[1] ?? "", user) })
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
        new ProductBundlesRepository(db),
        new SellableProductPriceRulesRepository(db),
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
    error instanceof OrderArchiveStatusError ||
    error instanceof OrderArchivedError ||
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

  const persistenceError = toOrderPersistenceError(error)
  if (persistenceError) {
    sendJson(response, persistenceError.statusCode, {
      error: persistenceError.error,
      code: persistenceError.code,
      constraint: persistenceError.constraint,
      detail: persistenceError.detail,
      column: persistenceError.column,
      table: persistenceError.table,
      ...(persistenceError.pg_message ? { pg_message: persistenceError.pg_message } : {}),
    })
    return
  }

  if (error instanceof Error && isKnownOrderInvariantError(error)) {
    sendJson(response, 500, {
      error: error.message,
    })
    return
  }

  throw error
}

interface OrderPersistenceErrorResponse {
  statusCode: number
  error: string
  code: string
  constraint?: string
  detail?: string
  column?: string
  table?: string
  /** Truncated driver/Postgres text for support logs; safe to read in server logs, not a secret. */
  pg_message?: string
}

/**
 * Turn Postgres error metadata into a short message operators can act on
 * (refresh, re-pick customer/items, fix quantities, or retry).
 */
function userMessageForOrderDbError(
  code: string,
  constraint: string | undefined,
  detail: string | undefined,
  column?: string | undefined,
  table?: string | undefined,
): string {
  const c = (constraint ?? "").toLowerCase()
  const d = (detail ?? "").toLowerCase()

  if (code === "23503") {
    if (c.includes("customer_id") || d.includes("customers")) {
      return "The customer on this order is no longer in the system. Refresh the page and select an active customer."
    }
    if (c.includes("cup_id") || d.includes('table "cups"') || d.includes("table 'cups'")) {
      return "A selected cup is no longer in the catalog. Refresh the page, remove that line, or pick another cup."
    }
    if (c.includes("lid_id") || d.includes('table "lids"') || d.includes("table 'lids'")) {
      return "A selected lid is no longer in the catalog. Refresh the page, remove that line, or pick another lid."
    }
    if (c.includes("non_stock_item") || d.includes("non_stock_items")) {
      return "A selected general item is no longer available. Refresh the page, remove that line, or pick another item."
    }
    if (c.includes("created_by_user")) {
      return "Your user account could not be linked to this order. Sign out and back in, or ask an admin to check your account."
    }
    return "Something on this order points to a record that was removed. Refresh the page, then re-select the customer and every line item."
  }

  if (code === "23505") {
    if (c.includes("order_number") || c.includes("orders_order_number")) {
      return "We could not save this order because the order number collided. Please try again."
    }
    return "This order could not be saved because it conflicts with existing data. Change the line items or try again."
  }

  if (code === "23514") {
    if (c.includes("order_items_quantity_positive")) {
      return "Each line must have a quantity of at least 1."
    }
    if (c.includes("order_items_unit_sell_price") || c.includes("order_items_unit_cost_price")) {
      return "A line has an invalid price. Check sell and cost prices on custom charges and try again."
    }
    if (c.includes("order_items_description_snapshot")) {
      return "A line is missing a description. Add a name or description for that line and try again."
    }
    if (c.includes("order_items_exactly_one_item")) {
      return "Each stock line must be either a cup, a lid, or a general item — not a mix on one line. Adjust the line and try again."
    }
    if (c.includes("order_items_item_type_matches_reference")) {
      return "A line’s type does not match the product you selected. Refresh the page and re-add that line, or pick a product that matches the line type."
    }
    if (c.includes("orders_order_number")) {
      return "The order number is not valid. Please try again or contact support if this keeps happening."
    }
    return "Some order details did not pass validation. Check line types, products, quantities, and prices, then try again."
  }

  if (code === "23502") {
    return "A required value is missing on the order. Fill in the highlighted fields and try again."
  }

  if (code === "22P02") {
    if (d.includes("uuid") || c.includes("uuid")) {
      return "The form contains an invalid id. Refresh the page and re-select the customer and products."
    }
    return "The order contains a value the system cannot read. Check quantities and prices, or refresh the page and try again."
  }

  if (code === "42703") {
    if (column) {
      return `The database is missing a required field (${column})${table ? ` on table ${table}` : ""}). Deploy a new API release (pre-deploy runs migrations) or have an admin run the migration command on the production database, then try again.`
    }
    return "The app could not save this order because the server database is out of date. Deploy a new API release or ask an admin to run database migrations, then try again."
  }

  if (code === "42P01") {
    if (table) {
      return `A required database object is missing (${table}). Deploy the latest API and run migrations, or ask an admin for help.`
    }
    return "The app could not save this order because the server database is out of date. Deploy a new API release or ask an admin to run database migrations, then try again."
  }

  if (code === "40001" || code === "40P01") {
    return "The system was busy and could not finish saving. Please try again in a moment."
  }

  if (code === "57014") {
    return "Saving the order took too long. Try again with fewer line items, or wait and retry."
  }

  return "The order could not be saved. Check your network, refresh the form, and try again. If a customer or product was deleted while you were working, re-select it."
}

const PG_MESSAGE_MAX = 2_000

function truncateForApiMessage(message: string, max: number): string {
  if (message.length <= max) {
    return message
  }
  return `${message.slice(0, max)}…`
}

function toOrderPersistenceError(error: unknown): OrderPersistenceErrorResponse | null {
  const meta = collectPostgresErrorMetadata(error)
  const code = meta?.code ?? getDbErrorCode(error)

  if (!code) {
    return null
  }

  const constraint = meta?.constraint ?? getDbErrorString(error, "constraint")
  const detail = meta?.detail ?? getDbErrorString(error, "detail")
  const column = meta?.column ?? getDbErrorString(error, "column")
  const table = meta?.table ?? getDbErrorString(error, "table")
  const pg_message = meta ? truncateForApiMessage(meta.driverMessage, PG_MESSAGE_MAX) : undefined
  const message = userMessageForOrderDbError(code, constraint, detail, column, table)

  const base = {
    error: message,
    code,
    constraint,
    detail,
    column,
    table,
    ...(pg_message ? { pg_message } : {}),
  }

  if (code === "23503") {
    return { statusCode: 409, ...base }
  }

  if (code === "23505") {
    return { statusCode: 409, ...base }
  }

  if (code === "23514" || code === "23502" || code === "22P02") {
    return { statusCode: 400, ...base }
  }

  if (code === "42703" || code === "42P01" || code === "40001" || code === "40P01" || code === "57014") {
    return { statusCode: 500, ...base }
  }

  return { statusCode: 500, ...base }
}

function getDbErrorCode(error: unknown): string | undefined {
  return getDbErrorString(error, "code")
}

function getDbErrorString(
  error: unknown,
  key: "code" | "constraint" | "detail" | "column" | "table",
): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined
  }

  if (key in error && typeof (error as Record<string, unknown>)[key] === "string") {
    return (error as Record<string, string>)[key]
  }

  if ("cause" in error) {
    return getDbErrorString((error as { cause?: unknown }).cause, key)
  }

  return undefined
}

function isKnownOrderInvariantError(error: Error): boolean {
  return [
    "Failed to create order",
    "Failed to load created order",
    "Failed to match created order item to reservation request",
    "Failed to match updated order item to reservation request",
    "Resolved order line item missing",
    "Failed to create invoice",
    "Failed to load created invoice",
    "Failed to load replaced invoice",
  ].includes(error.message)
}
