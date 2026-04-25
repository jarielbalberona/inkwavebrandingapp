import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { randomUUID } from "node:crypto"

import type { ApiEnv } from "./config/env.js"
import { sendJson } from "./http/json.js"
import { recordUnhandledErrorOnResponse, takeResponseLogForAccessLine } from "./http/response-log.js"
import { getRequestPath, isPublicRoute } from "./http/routes.js"
import { logError, logInfo, serializeError } from "./lib/logger.js"
import { handleAuthRoute } from "./modules/auth/auth.routes.js"
import { handleCustomersRoute } from "./modules/customers/customers.routes.js"
import { handleCupsRoute } from "./modules/cups/cups.routes.js"
import { handleDashboardRoute } from "./modules/dashboard/dashboard.routes.js"
import { handleInventoryRoute } from "./modules/inventory/inventory.routes.js"
import { handleInvoicesRoute } from "./modules/invoices/invoices.routes.js"
import { handleLidsRoute } from "./modules/lids/lids.routes.js"
import { handleNonStockItemsRoute } from "./modules/non-stock-items/non-stock-items.routes.js"
import { handleOrdersRoute } from "./modules/orders/orders.routes.js"
import { handleProductBundlesRoute } from "./modules/product-bundles/product-bundles.routes.js"
import { handleReportsRoute } from "./modules/reports/reports.routes.js"
import { handleSellableProductPriceRulesRoute } from "./modules/sellable-product-price-rules/sellable-product-price-rules.routes.js"
import { handleUsersRoute } from "./modules/users/users.routes.js"

export interface RuntimeApiEnv extends ApiEnv {
  authSessionSecret: string
}

export function createApiServer(env: RuntimeApiEnv): Server {
  return createServer(async (request, response) => {
    await handleApiRequest(request, response, env)
  })
}

export async function handleApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  env: RuntimeApiEnv,
): Promise<void> {
  const requestId = randomUUID()
  const path = getRequestPath(request)
  const startedAt = Date.now()

  response.setHeader("X-Request-Id", requestId)
  response.once("finish", () => {
    const logContext = takeResponseLogForAccessLine(response)
    const statusCode = response.statusCode
    const durationMs = Date.now() - startedAt
    const entry = {
      event: "http_request_completed",
      requestId,
      method: request.method ?? "UNKNOWN",
      path,
      statusCode,
      durationMs,
      ...(logContext?.unhandledError ? { unhandledError: logContext.unhandledError } : {}),
      ...(logContext?.clientError ? { clientError: logContext.clientError } : {}),
    }
    if (statusCode >= 500) {
      logError(entry as never)
    } else {
      logInfo(entry as never)
    }
  })

  try {
    applyCors(request, response, env)

    if (request.method === "OPTIONS") {
      response.writeHead(204)
      response.end()
      return
    }

    if (await handleAuthRoute(request, response, { env })) return
    if (await handleCupsRoute(request, response, { env })) return
    if (await handleCustomersRoute(request, response, { env })) return
    if (await handleInventoryRoute(request, response, { env })) return
    if (await handleLidsRoute(request, response, { env })) return
    if (await handleNonStockItemsRoute(request, response, { env })) return
    if (await handleProductBundlesRoute(request, response, { env })) return
    if (await handleSellableProductPriceRulesRoute(request, response, { env })) return
    if (await handleDashboardRoute(request, response, { env })) return
    if (await handleInvoicesRoute(request, response, { env })) return
    if (await handleOrdersRoute(request, response, { env })) return
    if (await handleReportsRoute(request, response, { env })) return
    if (await handleUsersRoute(request, response, { env })) return

    if (isPublicRoute(request.method, path) && request.method === "GET" && path === "/health") {
      sendJson(response, 200, { ok: true })
      return
    }

    sendJson(response, 404, { error: "Not found" })
  } catch (error) {
    logError({
      event: "http_request_failed",
      requestId,
      method: request.method ?? "UNKNOWN",
      path,
      statusCode: 500,
      ...serializeError(error),
    })
    recordUnhandledErrorOnResponse(response, error)
    sendJson(response, 500, { error: "Internal server error", requestId })
  }
}

function applyCors(request: IncomingMessage, response: ServerResponse, env: ApiEnv) {
  const origin = request.headers.origin

  if (!origin || env.webOrigins.length === 0 || !env.webOrigins.includes(origin)) {
    return
  }

  response.setHeader("Access-Control-Allow-Origin", origin)
  response.setHeader("Access-Control-Allow-Credentials", "true")
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, X-Request-Id")
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
  response.setHeader("Vary", "Origin")
}
