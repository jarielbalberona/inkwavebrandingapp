import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"
import { renderInvoicePdf, type InvoicePdfData } from "@workspace/pdfs/server"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import { OrdersRepository } from "../orders/orders.repository.js"
import { UsersRepository } from "../users/users.repository.js"
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
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const invoice = await service.getById(invoicePdfMatch[1] ?? "", user)
      const pdfBuffer = await renderInvoicePdf(toInvoicePdfData(invoice))

      response.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Length": pdfBuffer.byteLength,
        "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
      })
      response.end(pdfBuffer)
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

function toInvoicePdfData(invoice: Awaited<ReturnType<InvoicesService["getById"]>>): InvoicePdfData {
  const subtotal = invoice.subtotal
  const discount = "0.00"
  const total = subtotal
  const paidAmount = invoice.status === "paid" ? total : "0.00"
  const remainingBalance = invoice.status === "pending" ? total : "0.00"

  return {
    brand_name: "Ink Wave Branding App",
    document_title: "Invoice",
    invoice_number: invoice.invoice_number,
    order_reference: invoice.order_number_snapshot,
    generated_at: formatInvoicePdfDate(invoice.created_at),
    status: toInvoicePdfStatus(invoice.status),
    from: {
      label: "From",
      name: "Ink Wave Branding App",
      lines: [
        "Cup printing operations",
        "Production begins after invoice confirmation.",
      ],
    },
    to: {
      label: "To",
      name: invoice.customer.business_name,
      lines: [
        invoice.customer.contact_person,
        invoice.customer.contact_number,
        invoice.customer.email,
        invoice.customer.address,
      ].filter((line): line is string => Boolean(line)),
    },
    left_meta: [
      { label: "Invoice number", value: invoice.invoice_number },
      { label: "Generated", value: formatInvoicePdfDate(invoice.created_at) },
      { label: "Invoice status", value: toInvoicePdfStatus(invoice.status).label },
    ],
    right_meta: [
      { label: "Order reference", value: invoice.order_number_snapshot },
      { label: "Customer code", value: invoice.customer.customer_code ?? "N/A" },
      { label: "Line items", value: invoice.items.length.toLocaleString() },
    ],
    line_items: invoice.items.map((item) => ({
      item: item.description_snapshot,
      specs: toInvoicePdfSpecs(item.item_type),
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.line_total,
    })),
    subtotal: invoice.subtotal,
    discount,
    total,
    paid_amount: paidAmount,
    remaining_balance: remainingBalance,
    payment_instructions: toInvoicePdfPaymentInstructions(invoice.status),
    support_lines: [
      "Ink Wave Branding App",
      "Coordinate through the assigned order contact for invoice follow-up.",
    ],
    footer_note: invoice.status === "void" ? "This invoice has been voided." : "Thank you for your order.",
  }
}

function formatInvoicePdfDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function toInvoicePdfStatus(status: Awaited<ReturnType<InvoicesService["getById"]>>["status"]) {
  switch (status) {
    case "paid":
      return { label: "Paid", tone: "success" as const }
    case "void":
      return { label: "Void", tone: "danger" as const }
    default:
      return { label: "Pending", tone: "warning" as const }
  }
}

function toInvoicePdfSpecs(itemType: Awaited<ReturnType<InvoicesService["getById"]>>["items"][number]["item_type"]) {
  switch (itemType) {
    case "cup":
      return "Cup item"
    case "lid":
      return "Lid item"
    case "non_stock_item":
      return "General item"
    case "custom_charge":
      return "Custom charge"
  }
}

function toInvoicePdfPaymentInstructions(status: Awaited<ReturnType<InvoicesService["getById"]>>["status"]) {
  switch (status) {
    case "paid":
      return ["Payment recorded for this invoice."]
    case "void":
      return ["This invoice has been voided and is kept for record purposes only."]
    default:
      return [
        "Use the invoice number as the payment reference.",
        "Coordinate payment confirmation with Ink Wave operations before production starts.",
      ]
  }
}
