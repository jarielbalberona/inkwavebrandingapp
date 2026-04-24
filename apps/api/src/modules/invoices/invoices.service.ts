import { randomUUID } from "node:crypto"

import type { SafeUser } from "../auth/auth.schemas.js"
import { assertAdmin } from "../auth/authorization.js"
import { OrdersRepository } from "../orders/orders.repository.js"
import type { InvoicesListQuery } from "./invoices.schemas.js"
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

export class InvoiceOrderNotCompletedError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Invoice generation is only allowed for completed orders")
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

export function assertInvoiceAllowsStructuralChanges(status: InvoiceStatus) {
  if (status === "paid") {
    throw new InvoicePaidLockError()
  }

  if (status === "void") {
    throw new InvoiceVoidLockError()
  }
}

export class InvoicesService {
  constructor(
    private readonly invoicesRepository: InvoicesRepository,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async list(query: InvoicesListQuery, user: SafeUser): Promise<InvoiceListItemDto[]> {
    assertAdmin(user)

    const invoices = await this.invoicesRepository.list(query)

    return invoices.map((invoice) => toInvoiceListItemDto(invoice, user))
  }

  async getById(invoiceId: string, user: SafeUser): Promise<InvoiceDto> {
    assertAdmin(user)

    const invoice = await this.invoicesRepository.findByIdWithRelations(invoiceId)

    if (!invoice) {
      throw new InvoiceNotFoundError()
    }

    return toInvoiceDto(invoice, user)
  }

  async getByOrderId(orderId: string, user: SafeUser): Promise<InvoiceDto> {
    assertAdmin(user)

    const invoice = await this.invoicesRepository.findByOrderId(orderId)

    if (!invoice) {
      throw new InvoiceNotFoundError()
    }

    return toInvoiceDto(invoice, user)
  }

  async generateForOrder(orderId: string, user: SafeUser): Promise<InvoiceDto> {
    assertAdmin(user)

    // MVP invoices are immutable snapshots, so there is no separate status lifecycle yet.

    const existingInvoice = await this.invoicesRepository.findByOrderId(orderId)

    if (existingInvoice) {
      throw new InvoiceAlreadyExistsError()
    }

    const order = await this.ordersRepository.findByIdWithRelations(orderId)

    if (!order) {
      throw new InvoiceOrderNotFoundError()
    }

    if (order.status !== "completed") {
      throw new InvoiceOrderNotCompletedError()
    }

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

    const subtotal = sumMoney(items.map((item) => item.lineTotal))

    const invoice = await this.invoicesRepository.createInvoiceWithItems({
      invoice: {
        invoiceNumber: createInvoiceNumber(),
        orderId: order.id,
        orderNumberSnapshot: order.orderNumber,
        customerId: order.customer.id,
        customerCodeSnapshot: order.customer.customerCode,
        customerBusinessNameSnapshot: order.customer.businessName,
        customerContactPersonSnapshot: order.customer.contactPerson,
        customerContactNumberSnapshot: order.customer.contactNumber,
        customerEmailSnapshot: order.customer.email,
        customerAddressSnapshot: order.customer.address,
        status: "pending",
        subtotal,
        createdByUserId: user.id,
      },
      items,
    })

    return toInvoiceDto(invoice, user)
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
