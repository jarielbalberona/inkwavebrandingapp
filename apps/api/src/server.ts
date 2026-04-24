import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { randomUUID } from "node:crypto"

import { loadApiEnv } from "./config/env.js"
import { sendJson } from "./http/json.js"
import { getRequestPath, isPublicRoute } from "./http/routes.js"
import { initSentry } from "./instrumentation/sentry.js"
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
import { handleReportsRoute } from "./modules/reports/reports.routes.js"

const env = loadApiEnv()

if (!env.authSessionSecret) {
  throw new Error("Invalid API environment: AUTH_SESSION_SECRET is required")
}

const runtimeEnv = {
  ...env,
  authSessionSecret: env.authSessionSecret,
}

initSentry()

const server = createServer(async (request, response) => {
  const requestId = randomUUID()
  const path = getRequestPath(request)
  const startedAt = Date.now()

  response.setHeader("X-Request-Id", requestId)
  response.once("finish", () => {
    logInfo({
      event: "http_request_completed",
      requestId,
      method: request.method ?? "UNKNOWN",
      path,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
    })
  })

  try {
    applyCors(request, response)

    if (request.method === "OPTIONS") {
      response.writeHead(204)
      response.end()
      return
    }

    if (await handleAuthRoute(request, response, { env: runtimeEnv })) {
      return
    }

    if (await handleCupsRoute(request, response, { env: runtimeEnv })) {
      return
    }

    if (await handleCustomersRoute(request, response, { env: runtimeEnv })) {
      return
    }

    if (await handleInventoryRoute(request, response, { env: runtimeEnv })) {
      return
    }

    if (await handleLidsRoute(request, response, { env: runtimeEnv })) {
      return
    }

    if (await handleNonStockItemsRoute(request, response, { env: runtimeEnv })) {
      return
    }

    if (await handleDashboardRoute(request, response, { env: runtimeEnv })) {
      return
    }

    if (await handleInvoicesRoute(request, response, { env: runtimeEnv })) {
      return
    }

    if (await handleOrdersRoute(request, response, { env: runtimeEnv })) {
      return
    }

    if (await handleReportsRoute(request, response, { env: runtimeEnv })) {
      return
    }

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
    sendJson(response, 500, { error: "Internal server error", requestId })
  }
})

server.listen(env.port, () => {
  logInfo({
    event: "api_server_started",
    nodeEnv: env.nodeEnv,
    port: env.port,
    databaseConfigured: Boolean(env.databaseUrl),
    sentryEnabled: Boolean(env.sentryDsn),
    webOriginConfigured: Boolean(env.webOrigin),
  })
})

function applyCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin

  if (!origin || !env.webOrigin || origin !== env.webOrigin) {
    return
  }

  response.setHeader("Access-Control-Allow-Origin", origin)
  response.setHeader("Access-Control-Allow-Credentials", "true")
  response.setHeader("Access-Control-Allow-Headers", "Content-Type")
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
  response.setHeader("Vary", "Origin")
}
