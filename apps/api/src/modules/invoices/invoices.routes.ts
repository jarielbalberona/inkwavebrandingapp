import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import { AssetsRepository } from "../assets/assets.repository.js"
import { OrdersRepository } from "../orders/orders.repository.js"
import { UsersRepository } from "../users/users.repository.js"
import { InvoiceDocumentsService } from "./invoice-documents.service.js"
import { invoicesListQuerySchema } from "./invoices.schemas.js"
import { InvoicesRepository } from "./invoices.repository.js"
import {
  InvoiceAlreadyExistsError,
  InvoiceNotFoundError,
  InvoiceOrderCanceledError,
  InvoiceOrderNotFoundError,
  InvoicesService,
} from "./invoices.service.js"

interface InvoicesRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleInvoicesRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: InvoicesRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/invoices" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = invoicesListQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, { invoices: await service.list(query, user) })
    })
    return true
  }

  const orderInvoiceMatch = path.match(/^\/orders\/([^/]+)\/invoice$/)

  if (orderInvoiceMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, { invoice: await service.getByOrderId(orderInvoiceMatch[1] ?? "", user) })
    })
    return true
  }

  if (orderInvoiceMatch && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 201, { invoice: await service.generateForOrder(orderInvoiceMatch[1] ?? "", user) })
    })
    return true
  }

  const invoiceMatch = path.match(/^\/invoices\/([^/]+)$/)

  if (invoiceMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, { invoice: await service.getById(invoiceMatch[1] ?? "", user) })
    })
    return true
  }

  const invoicePdfMatch = path.match(/^\/invoices\/([^/]+)\/pdf$/)

  if (invoicePdfMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (_, user) => {
      const db = getDatabaseClient()
      const pdfDocument = await InvoiceDocumentsService.fromEnv(
        new InvoicesRepository(db),
        new AssetsRepository(db),
        context.env,
      ).getPdfDocument(invoicePdfMatch[1] ?? "", user)

      response.writeHead(200, {
        "Content-Type": pdfDocument.contentType,
        "Content-Length": pdfDocument.contentLength,
        "Content-Disposition": `inline; filename="${pdfDocument.filename}"`,
      })
      response.end(pdfDocument.body)
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: InvoicesRouteContext,
  handler: (
    service: InvoicesService,
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
      new InvoicesService(new InvoicesRepository(db), new OrdersRepository(db)),
      authContext.user,
    )
  } catch (error) {
    handleInvoicesError(response, error)
  }
}

function handleInvoicesError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    sendJson(response, 400, { error: "Invalid invoice request" })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (
    error instanceof InvoiceNotFoundError ||
    error instanceof InvoiceOrderNotFoundError ||
    error instanceof InvoiceAlreadyExistsError ||
    error instanceof InvoiceOrderCanceledError
  ) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
