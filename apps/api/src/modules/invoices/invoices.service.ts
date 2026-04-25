import { randomUUID } from "node:crypto"

import type { SafeUser } from "../auth/auth.schemas.js"
import { assertPermission } from "../auth/authorization.js"
import { OrdersRepository } from "../orders/orders.repository.js"
import type {
  CreateInvoicePaymentInput,
  InvoicesListQuery,
  UpdateInvoicePaymentInput,
} from "./invoices.schemas.js"
import {
  toInvoiceDto,
  toInvoiceListItemDto,
  type InvoiceDto,
  type InvoiceListItemDto,
  type InvoiceStatus,
} from "./invoices.types.js"
import { InvoicesRepository } from "./invoices.repository.js"

export class InvoiceNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Invoice not found")
  }
}

export class InvoiceOrderNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Order not found")
  }
}

export class InvoiceAlreadyExistsError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Invoice already exists for this order")
  }
}

export class InvoiceOrderCanceledError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Invoice generation is not allowed for canceled orders")
  }
}

export class InvoicePaidLockError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Invoice is locked because it has been paid")
  }
}

export class InvoiceVoidLockError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Invoice is locked because it has been voided")
  }
}

export class InvoicePaymentLockError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Invoice is locked because payments have already been recorded")
  }
}

export class InvoiceAlreadyPaidError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Invoice is already fully paid")
  }
}

export class InvoicePaymentOverpaymentError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Payment amount exceeds the remaining balance")
  }
}

export class InvoicePaymentVoidError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Cannot record payment for a void invoice")
  }
}

export class InvoicePaymentNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Invoice payment not found")
  }
}

export class InvoiceVoidAfterPaymentError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Invoices with recorded payments cannot be voided")
  }
}

export class InvoiceVoidActiveOrderError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Cancel the linked order before voiding this invoice")
  }
}

export class InvoiceArchiveError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Invoice is already archived")
  }
}

export class InvoiceArchiveStatusError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Only void invoices can be archived")
  }
}

export class InvoiceAlreadyVoidError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Invoice is already void")
  }
}

export function assertInvoiceAllowsStructuralChanges(input: {
  status: InvoiceStatus
  paidAmount?: string | null
}) {
  if (input.status === "paid") {
    throw new InvoicePaidLockError()
  }

  if (input.status === "void") {
    throw new InvoiceVoidLockError()
  }

  if (input.paidAmount && moneyToCents(input.paidAmount) > 0n) {
    throw new InvoicePaymentLockError()
  }
}

interface InvoiceSnapshotOrder {
  id: string
  orderNumber: string
  customer: {
    id: string
    customerCode: string | null
    businessName: string
    contactPerson: string | null
    contactNumber: string | null
    email: string | null
    address: string | null
  }
  items: Array<{
    id: string
    itemType: "cup" | "lid" | "non_stock_item" | "custom_charge" | "product_bundle"
    descriptionSnapshot: string
    quantity: number
    unitSellPrice: string
  }>
}

function buildInvoiceSnapshotInput(order: InvoiceSnapshotOrder) {
  const items = order.items.map((item) => {
    const unitPrice = item.unitSellPrice
    const lineTotal = multiplyMoneyByQuantity(unitPrice, item.quantity)

    return {
      orderItemId: item.id,
      itemType: item.itemType,
      descriptionSnapshot: item.descriptionSnapshot,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
    }
  })

  const totalAmount = sumMoney(items.map((item) => item.lineTotal))

  return {
    invoice: {
      orderNumberSnapshot: order.orderNumber,
      customerId: order.customer.id,
      customerCodeSnapshot: order.customer.customerCode,
      customerBusinessNameSnapshot: order.customer.businessName,
      customerContactPersonSnapshot: order.customer.contactPerson,
      customerContactNumberSnapshot: order.customer.contactNumber,
      customerEmailSnapshot: order.customer.email,
      customerAddressSnapshot: order.customer.address,
      subtotal: totalAmount,
      totalAmount,
      remainingBalance: totalAmount,
    },
    items,
  }
}

export async function syncInvoiceSnapshotForOrder(
  invoicesRepository: Pick<
    InvoicesRepository,
    "createInvoiceWithItems" | "findByOrderId" | "replaceInvoiceSnapshotWithItems"
  >,
  order: InvoiceSnapshotOrder,
  createdByUserId: string,
) {
  const snapshot = buildInvoiceSnapshotInput(order)
  const existingInvoice = await invoicesRepository.findByOrderId(order.id)

  if (!existingInvoice) {
    return invoicesRepository.createInvoiceWithItems({
      invoice: {
        invoiceNumber: createInvoiceNumber(),
        orderId: order.id,
        status: "pending",
        paidAmount: "0.00",
        createdByUserId,
        ...snapshot.invoice,
      },
      items: snapshot.items,
    })
  }

  assertInvoiceAllowsStructuralChanges({
    status: existingInvoice.status,
    paidAmount: existingInvoice.paidAmount,
  })

  return invoicesRepository.replaceInvoiceSnapshotWithItems({
    invoiceId: existingInvoice.id,
    invoice: snapshot.invoice,
    items: snapshot.items,
  })
}

export class InvoicesService {
  constructor(
    private readonly invoicesRepository: InvoicesRepository,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async list(query: InvoicesListQuery, user: SafeUser): Promise<InvoiceListItemDto[]> {
    assertPermission(user, "invoices.view")

    const invoices = await this.invoicesRepository.list(query)

    return invoices.map((invoice) => toInvoiceListItemDto(invoice, user))
  }

  async getById(invoiceId: string, user: SafeUser): Promise<InvoiceDto> {
    assertPermission(user, "invoices.view")

    const invoice = await this.invoicesRepository.findByIdWithRelations(invoiceId)

    if (!invoice) {
      throw new InvoiceNotFoundError()
    }

    return toInvoiceDto(invoice, user)
  }

  async getByOrderId(orderId: string, user: SafeUser): Promise<InvoiceDto> {
    assertPermission(user, "invoices.view")

    const invoice = await this.invoicesRepository.findByOrderId(orderId)

    if (!invoice) {
      throw new InvoiceNotFoundError()
    }

    return toInvoiceDto(invoice, user)
  }

  async generateForOrder(orderId: string, user: SafeUser): Promise<InvoiceDto> {
    assertPermission(user, "invoices.manage")

    const existingInvoice = await this.invoicesRepository.findByOrderId(orderId)

    if (existingInvoice) {
      throw new InvoiceAlreadyExistsError()
    }

    const order = await this.ordersRepository.findByIdWithRelations(orderId)

    if (!order) {
      throw new InvoiceOrderNotFoundError()
    }

    if (order.status === "canceled") {
      throw new InvoiceOrderCanceledError()
    }

    const invoice = await syncInvoiceSnapshotForOrder(this.invoicesRepository, order, user.id)

    return toInvoiceDto(invoice, user)
  }

  async recordPayment(
    invoiceId: string,
    input: CreateInvoicePaymentInput,
    user: SafeUser,
  ): Promise<InvoiceDto> {
    assertPermission(user, "invoices.manage")

    return this.invoicesRepository.transaction(async ({ invoicesRepository }) => {
      const invoice = await invoicesRepository.findByIdWithRelations(invoiceId)

      if (!invoice) {
        throw new InvoiceNotFoundError()
      }

      if (invoice.status === "void") {
        throw new InvoicePaymentVoidError()
      }

      if (invoice.status === "paid" || moneyToCents(invoice.remainingBalance) === 0n) {
        throw new InvoiceAlreadyPaidError()
      }

      if (moneyToCents(input.amount) > moneyToCents(invoice.remainingBalance)) {
        throw new InvoicePaymentOverpaymentError()
      }

      const nextPaidAmount = centsToMoney(moneyToCents(invoice.paidAmount) + moneyToCents(input.amount))
      const nextRemainingBalance = centsToMoney(
        moneyToCents(invoice.totalAmount) - moneyToCents(nextPaidAmount),
      )

      await invoicesRepository.createPayment({
        invoiceId,
        payment: {
          amount: input.amount,
          paymentDate: input.payment_date,
          note: input.note,
          createdByUserId: user.id,
        },
      })

      await invoicesRepository.updateFinancialState(invoiceId, {
        status: moneyToCents(nextRemainingBalance) === 0n ? "paid" : "pending",
        paidAmount: nextPaidAmount,
        remainingBalance: nextRemainingBalance,
      })

      const updatedInvoice = await invoicesRepository.findByIdWithRelations(invoiceId)

      if (!updatedInvoice) {
        throw new InvoiceNotFoundError()
      }

      return toInvoiceDto(updatedInvoice, user)
    })
  }

  async updatePayment(
    invoiceId: string,
    paymentId: string,
    input: UpdateInvoicePaymentInput,
    user: SafeUser,
  ): Promise<InvoiceDto> {
    assertPermission(user, "invoices.manage")

    return this.invoicesRepository.transaction(async ({ invoicesRepository }) => {
      const invoice = await invoicesRepository.findByIdWithRelations(invoiceId)

      if (!invoice) {
        throw new InvoiceNotFoundError()
      }

      if (invoice.status === "void") {
        throw new InvoicePaymentVoidError()
      }

      const existingPayment = invoice.payments.find((payment) => payment.id === paymentId)

      if (!existingPayment) {
        throw new InvoicePaymentNotFoundError()
      }

      const otherPaymentsPaidAmount = invoice.payments.reduce((sum, payment) => {
        if (payment.id === paymentId) {
          return sum
        }

        return sum + moneyToCents(payment.amount)
      }, 0n)

      const nextPaidAmountCents = otherPaymentsPaidAmount + moneyToCents(input.amount)

      if (nextPaidAmountCents > moneyToCents(invoice.totalAmount)) {
        throw new InvoicePaymentOverpaymentError()
      }

      const updatedPayment = await invoicesRepository.updatePayment({
        invoiceId,
        paymentId,
        payment: {
          amount: input.amount,
          paymentDate: input.payment_date,
          note: input.note,
        },
      })

      if (!updatedPayment) {
        throw new InvoicePaymentNotFoundError()
      }

      await invoicesRepository.updateFinancialState(invoiceId, toInvoiceFinancialState(invoice.totalAmount, nextPaidAmountCents))

      const updatedInvoice = await invoicesRepository.findByIdWithRelations(invoiceId)

      if (!updatedInvoice) {
        throw new InvoiceNotFoundError()
      }

      return toInvoiceDto(updatedInvoice, user)
    })
  }

  async deletePayment(invoiceId: string, paymentId: string, user: SafeUser): Promise<InvoiceDto> {
    assertPermission(user, "invoices.manage")

    return this.invoicesRepository.transaction(async ({ invoicesRepository }) => {
      const invoice = await invoicesRepository.findByIdWithRelations(invoiceId)

      if (!invoice) {
        throw new InvoiceNotFoundError()
      }

      if (invoice.status === "void") {
        throw new InvoicePaymentVoidError()
      }

      const existingPayment = invoice.payments.find((payment) => payment.id === paymentId)

      if (!existingPayment) {
        throw new InvoicePaymentNotFoundError()
      }

      const nextPaidAmountCents = invoice.payments.reduce((sum, payment) => {
        if (payment.id === paymentId) {
          return sum
        }

        return sum + moneyToCents(payment.amount)
      }, 0n)

      const deletedPayment = await invoicesRepository.deletePayment({ invoiceId, paymentId })

      if (!deletedPayment) {
        throw new InvoicePaymentNotFoundError()
      }

      await invoicesRepository.updateFinancialState(invoiceId, toInvoiceFinancialState(invoice.totalAmount, nextPaidAmountCents))

      const updatedInvoice = await invoicesRepository.findByIdWithRelations(invoiceId)

      if (!updatedInvoice) {
        throw new InvoiceNotFoundError()
      }

      return toInvoiceDto(updatedInvoice, user)
    })
  }

  async archive(invoiceId: string, user: SafeUser): Promise<InvoiceDto> {
    assertPermission(user, "invoices.manage")

    return this.invoicesRepository.transaction(async ({ invoicesRepository }) => {
      const invoice = await invoicesRepository.findByIdWithRelations(invoiceId)

      if (!invoice) {
        throw new InvoiceNotFoundError()
      }

      if (invoice.archivedAt) {
        throw new InvoiceArchiveError()
      }

      if (invoice.status !== "void") {
        throw new InvoiceArchiveStatusError()
      }

      await invoicesRepository.archive(invoiceId)

      const updatedInvoice = await invoicesRepository.findByIdWithRelations(invoiceId)

      if (!updatedInvoice) {
        throw new InvoiceNotFoundError()
      }

      return toInvoiceDto(updatedInvoice, user)
    })
  }

  async void(invoiceId: string, user: SafeUser): Promise<InvoiceDto> {
    assertPermission(user, "invoices.manage")

    return this.invoicesRepository.transaction(async ({ invoicesRepository }) => {
      const invoice = await invoicesRepository.findByIdWithRelations(invoiceId)

      if (!invoice) {
        throw new InvoiceNotFoundError()
      }

      if (invoice.status === "void") {
        throw new InvoiceAlreadyVoidError()
      }

      const paymentRows = invoice.payments ?? []

      if (paymentRows.length > 0 || moneyToCents(invoice.paidAmount) > 0n || invoice.status === "paid") {
        throw new InvoiceVoidAfterPaymentError()
      }

      const linkedOrder = await this.ordersRepository.findByIdWithRelations(invoice.orderId)

      if (!linkedOrder) {
        throw new InvoiceOrderNotFoundError()
      }

      if (linkedOrder.status !== "canceled") {
        throw new InvoiceVoidActiveOrderError()
      }

      await invoicesRepository.updateFinancialState(invoiceId, {
        status: "void",
        paidAmount: centsToMoney(moneyToCents(invoice.paidAmount)),
        remainingBalance: centsToMoney(
          moneyToCents(invoice.totalAmount) - moneyToCents(invoice.paidAmount),
        ),
      })

      const updatedInvoice = await invoicesRepository.findByIdWithRelations(invoiceId)

      if (!updatedInvoice) {
        throw new InvoiceNotFoundError()
      }

      return toInvoiceDto(updatedInvoice, user)
    })
  }
}

function createInvoiceNumber() {
  const datePrefix = new Date().toISOString().slice(0, 10).replaceAll("-", "")

  return `INV-${datePrefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function multiplyMoneyByQuantity(value: string, quantity: number) {
  const cents = moneyToCents(value)

  return centsToMoney(cents * BigInt(quantity))
}

function sumMoney(values: string[]) {
  const total = values.reduce((sum, value) => sum + moneyToCents(value), 0n)

  return centsToMoney(total)
}

function toInvoiceFinancialState(totalAmount: string, paidAmountCents: bigint) {
  const totalAmountCents = moneyToCents(totalAmount)
  const remainingBalanceCents = totalAmountCents - paidAmountCents

  return {
    status: remainingBalanceCents === 0n ? "paid" as const : "pending" as const,
    paidAmount: centsToMoney(paidAmountCents),
    remainingBalance: centsToMoney(remainingBalanceCents),
  }
}

function moneyToCents(value: string) {
  const normalized = value.trim()

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid money value: ${value}`)
  }

  const isNegative = normalized.startsWith("-")
  const unsigned = isNegative ? normalized.slice(1) : normalized
  const [wholePart, decimalPart = ""] = unsigned.split(".")
  const paddedDecimals = `${decimalPart}00`.slice(0, 2)
  const cents = BigInt(wholePart) * 100n + BigInt(paddedDecimals)

  return isNegative ? -cents : cents
}

function centsToMoney(value: bigint) {
  const isNegative = value < 0
  const absolute = isNegative ? -value : value
  const whole = absolute / 100n
  const cents = absolute % 100n

  return `${isNegative ? "-" : ""}${whole.toString()}.${cents.toString().padStart(2, "0")}`
}
