import test from "node:test"
import assert from "node:assert/strict"

import { InvoicePaymentLockError } from "../invoices/invoices.service.js"
import { OrderArchiveStatusError, OrdersService } from "./orders.service.js"

function createOrdersService(overrides: {
  listWithRelations: () => Promise<unknown>
  hasAnyOrders: () => Promise<boolean>
}) {
  return new OrdersService(
    {
      listWithRelations: overrides.listWithRelations,
      hasAnyOrders: overrides.hasAnyOrders,
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    (() => ({})) as never,
  )
}

const adminUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin" as const,
  permissions: [],
}

test("OrdersService.list returns an empty list when relation loading fails against an empty orders table", async () => {
  const service = createOrdersService({
    listWithRelations: async () => {
      throw new Error("Failed query", {
        cause: { code: "42P01" },
      })
    },
    hasAnyOrders: async () => false,
  })

  const orders = await service.list({}, adminUser)

  assert.deepEqual(orders, [])
})

test("OrdersService.list still fails when relation loading breaks and orders already exist", async () => {
  const service = createOrdersService({
    listWithRelations: async () => {
      throw new Error("Failed query", {
        cause: { code: "42P01" },
      })
    },
    hasAnyOrders: async () => true,
  })

  await assert.rejects(() => service.list({}, adminUser), /Failed query/)
})

test("OrdersService.cancel leaves an unpaid pending linked invoice pending for a separate void step", async () => {
  let canceledOrderId: string | null = null
  let invoiceFinancialState: unknown = null
  const now = new Date("2026-04-24T09:00:00.000Z")
  let order = buildOrder({ status: "pending", updatedAt: now })

  const fakeDb = {
    query: {
      invoices: {
        findFirst: async () => ({
          id: "invoice-1",
          orderId: "order-1",
          status: "pending",
          totalAmount: "1000.00",
          paidAmount: "0.00",
          remainingBalance: "1000.00",
          payments: [],
        }),
      },
    },
    update: () => ({
      set: (input: unknown) => {
        invoiceFinancialState = input
        return {
          where: async () => undefined,
        }
      },
    }),
  }

  const ordersRepository = {
    transaction: async (handler: (context: { db: unknown; ordersRepository: unknown }) => Promise<unknown>) =>
      handler({ db: fakeDb, ordersRepository }),
    findByIdWithRelations: async () => order,
    listOrderItemsWithProgressEvents: async () => [],
    cancelOrder: async (orderId: string) => {
      canceledOrderId = orderId
      order = {
        ...order,
        status: "canceled",
        canceledAt: now,
      }
    },
  }

  const service = new OrdersService(
    ordersRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    (() => ({})) as never,
  )

  const canceledOrder = await service.cancel("order-1", adminUser)

  assert.equal(canceledOrderId, "order-1")
  assert.equal(canceledOrder.status, "canceled")
  assert.equal(invoiceFinancialState, null)
})

test("OrdersService.cancel rejects a linked pending invoice once payments exist", async () => {
  let cancelAttempted = false
  const order = buildOrder({ status: "pending" })

  const fakeDb = {
    query: {
      invoices: {
        findFirst: async () => ({
          id: "invoice-1",
          orderId: "order-1",
          status: "pending",
          totalAmount: "1000.00",
          paidAmount: "250.00",
          remainingBalance: "750.00",
          payments: [{ id: "payment-1" }],
        }),
      },
    },
  }

  const ordersRepository = {
    transaction: async (handler: (context: { db: unknown; ordersRepository: unknown }) => Promise<unknown>) =>
      handler({ db: fakeDb, ordersRepository }),
    findByIdWithRelations: async () => order,
    listOrderItemsWithProgressEvents: async () => [],
    cancelOrder: async () => {
      cancelAttempted = true
    },
  }

  const service = new OrdersService(
    ordersRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    (() => ({})) as never,
  )

  await assert.rejects(() => service.cancel("order-1", adminUser), InvoicePaymentLockError)
  assert.equal(cancelAttempted, false)
})

test("OrdersService.archive rejects orders that are not canceled", async () => {
  let archiveAttempted = false
  const order = buildOrder({ status: "pending" })
  const ordersRepository = {
    findByIdWithRelations: async () => order,
    archiveOrder: async () => {
      archiveAttempted = true
    },
  }
  const service = new OrdersService(
    ordersRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    (() => ({})) as never,
  )

  await assert.rejects(() => service.archive("order-1", adminUser), OrderArchiveStatusError)
  assert.equal(archiveAttempted, false)
})

test("OrdersService.archive archives canceled orders", async () => {
  let archiveAttempted = false
  let order = buildOrder({ status: "canceled", canceledAt: new Date("2026-04-24T09:00:00.000Z") })
  const ordersRepository = {
    findByIdWithRelations: async () => order,
    archiveOrder: async () => {
      archiveAttempted = true
      order = { ...order, archivedAt: new Date("2026-04-24T10:00:00.000Z") }
    },
  }
  const service = new OrdersService(
    ordersRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    (() => ({})) as never,
  )

  const archivedOrder = await service.archive("order-1", adminUser)

  assert.equal(archiveAttempted, true)
  assert.equal(archivedOrder.archived_at, "2026-04-24T10:00:00.000Z")
})

function buildOrder(overrides: Record<string, unknown> = {}): any {
  const now = new Date("2026-04-24T08:00:00.000Z")

  return {
    id: "order-1",
    orderNumber: "ORD-001",
    priority: 1,
    status: "pending",
    customerId: "customer-1",
    customer: {
      id: "customer-1",
      customerCode: "CUST-001",
      businessName: "Ink Wave Cafe",
      contactPerson: null,
      contactNumber: null,
      email: null,
      address: null,
      notes: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    items: [],
    notes: null,
    archivedAt: null,
    canceledAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
