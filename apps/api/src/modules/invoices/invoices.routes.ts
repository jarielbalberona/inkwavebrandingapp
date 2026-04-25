import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import { AssetsRepository } from "../assets/assets.repository.js"
import { OrdersRepository } from "../orders/orders.repository.js"
import { UsersRepository } from "../users/users.repository.js"
import {
  InvoiceDocumentsService,
  InvoiceShareLinkUnavailableError,
} from "./invoice-documents.service.js"
import {
  createInvoicePaymentSchema,
  invoicesListQuerySchema,
  updateInvoicePaymentSchema,
} from "./invoices.schemas.js"
import { InvoicesRepository } from "./invoices.repository.js"
import {
  InvoiceAlreadyExistsError,
  InvoiceAlreadyPaidError,
  InvoiceAlreadyVoidError,
  InvoiceArchiveError,
  InvoiceArchiveStatusError,
  InvoiceNotFoundError,
  InvoiceOrderCanceledError,
  InvoiceOrderNotFoundError,
  InvoicePaymentNotFoundError,
  InvoicePaymentOverpaymentError,
  InvoicePaymentVoidError,
  InvoiceVoidActiveOrderError,
  InvoiceVoidAfterPaymentError,
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

  const invoicePaymentsMatch = path.match(/^\/invoices\/([^/]+)\/payments$/)

  if (invoicePaymentsMatch && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createInvoicePaymentSchema.parse(await readJsonBody(request))

      sendJson(response, 201, {
        invoice: await service.recordPayment(invoicePaymentsMatch[1] ?? "", input, user),
      })
    })
    return true
  }

  const invoicePaymentMatch = path.match(/^\/invoices\/([^/]+)\/payments\/([^/]+)$/)

  if (invoicePaymentMatch && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = updateInvoicePaymentSchema.parse(await readJsonBody(request))

      sendJson(response, 200, {
        invoice: await service.updatePayment(
          invoicePaymentMatch[1] ?? "",
          invoicePaymentMatch[2] ?? "",
          input,
          user,
        ),
      })
    })
    return true
  }

  if (invoicePaymentMatch && request.method === "DELETE") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        invoice: await service.deletePayment(
          invoicePaymentMatch[1] ?? "",
          invoicePaymentMatch[2] ?? "",
          user,
        ),
      })
    })
    return true
  }

  const invoiceVoidMatch = path.match(/^\/invoices\/([^/]+)\/void$/)

  if (invoiceVoidMatch && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, { invoice: await service.void(invoiceVoidMatch[1] ?? "", user) })
    })
    return true
  }

  const invoiceArchiveMatch = path.match(/^\/invoices\/([^/]+)\/archive$/)

  if (invoiceArchiveMatch && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, { invoice: await service.archive(invoiceArchiveMatch[1] ?? "", user) })
    })
    return true
  }

  const invoicePdfMatch = path.match(/^\/invoices\/([^/]+)\/pdf$/)
  const invoiceShareLinkMatch = path.match(/^\/invoices\/([^/]+)\/share-link$/)

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

  if (invoiceShareLinkMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (_, user) => {
      const db = getDatabaseClient()
      const shareLink = await InvoiceDocumentsService.fromEnv(
        new InvoicesRepository(db),
        new AssetsRepository(db),
        context.env,
      ).getShareablePdfLink(invoiceShareLinkMatch[1] ?? "", user)

      sendJson(response, 200, shareLink)
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
    error instanceof InvoiceOrderCanceledError ||
    error instanceof InvoiceAlreadyPaidError ||
    error instanceof InvoiceAlreadyVoidError ||
    error instanceof InvoiceArchiveError ||
    error instanceof InvoiceArchiveStatusError ||
    error instanceof InvoicePaymentNotFoundError ||
    error instanceof InvoicePaymentOverpaymentError ||
    error instanceof InvoicePaymentVoidError ||
    error instanceof InvoiceVoidAfterPaymentError ||
    error instanceof InvoiceVoidActiveOrderError ||
    error instanceof InvoiceShareLinkUnavailableError
  ) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
