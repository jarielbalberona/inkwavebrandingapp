import test from "node:test"
import assert from "node:assert/strict"

import type { SafeUser } from "../auth/auth.schemas.js"
import { InvoicePaymentLockError } from "../invoices/invoices.service.js"
import {
  getPriorityForNewOrder,
  OrderArchiveStatusError,
  OrdersService,
} from "./orders.service.js"

function createOrdersService(overrides: {
  listWithRelations: (query?: unknown) => Promise<unknown>
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
    (() => ({})) as never
  )
}

const adminUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin" as const,
  permissions: [],
}

const productionStaffUser: SafeUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "production@example.com",
  displayName: "Production",
  role: "staff" as const,
  permissions: ["orders.view", "orders.fulfillment.record"],
}

test("getPriorityForNewOrder appends after the current lowest-priority order", () => {
  assert.equal(getPriorityForNewOrder(null), 0)
  assert.equal(getPriorityForNewOrder(0), 1)
  assert.equal(getPriorityForNewOrder(12), 13)
})

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

test("OrdersService.list restricts production staff to orders with started payment", async () => {
  let listQuery: unknown
  const service = createOrdersService({
    listWithRelations: async (query) => {
      listQuery = query
      return []
    },
    hasAnyOrders: async () => true,
  })

  const orders = await service.list({}, productionStaffUser)

  assert.deepEqual(orders, [])
  assert.deepEqual(listQuery, {
    status: undefined,
    includeArchived: false,
    requirePaymentStarted: true,
  })
})

test("OrdersService.list restricts admins to orders with started payment", async () => {
  let listQuery: unknown
  const service = createOrdersService({
    listWithRelations: async (query) => {
      listQuery = query
      return []
    },
    hasAnyOrders: async () => true,
  })

  await service.list({}, adminUser)

  assert.deepEqual(listQuery, {
    status: undefined,
    includeArchived: false,
    requirePaymentStarted: true,
  })
})

test("OrdersService.createProgressEvent rejects production staff before any payment is recorded", async () => {
  let checkedPaymentForOrderId: string | null = null
  const ordersRepository = {
    transaction: async (
      handler: (context: {
        db: unknown
        ordersRepository: unknown
      }) => Promise<unknown>
    ) => handler({ db: {}, ordersRepository }),
    lockOrderItem: async () => undefined,
    findOrderItemWithOrder: async () => ({
      id: "33333333-3333-3333-3333-333333333333",
      orderId: "order-1",
      itemType: "cup",
      cupId: "44444444-4444-4444-4444-444444444444",
      lidId: null,
      productBundleId: null,
      quantity: 10,
      order: {
        id: "order-1",
        status: "pending",
      },
      cup: null,
      lid: null,
      nonStockItem: null,
      productBundle: null,
    }),
    hasStartedPaymentForOrder: async (orderId: string) => {
      checkedPaymentForOrderId = orderId
      return false
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
    (() => ({})) as never
  )

  await assert.rejects(
    () =>
      service.createProgressEvent(
        "33333333-3333-3333-3333-333333333333",
        {
          stage: "printed",
          quantity: 1,
          event_date: new Date("2026-05-18T00:00:00.000Z"),
        },
        productionStaffUser
      ),
    /Payment must be recorded before production can start/
  )
  assert.equal(checkedPaymentForOrderId, "order-1")
})

test("OrdersService.cancel voids an unpaid pending linked invoice", async () => {
  let canceledOrderId: string | null = null
  let invoiceFinancialState: {
    status?: string
    paidAmount?: string
    remainingBalance?: string
    updatedAt?: Date
  } = {}
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
        invoiceFinancialState = input as NonNullable<
          typeof invoiceFinancialState
        >
        return {
          where: async () => undefined,
        }
      },
    }),
  }

  const ordersRepository = {
    transaction: async (
      handler: (context: {
        db: unknown
        ordersRepository: unknown
      }) => Promise<unknown>
    ) => handler({ db: fakeDb, ordersRepository }),
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
    (() => ({})) as never
  )

  const canceledOrder = await service.cancel("order-1", adminUser)

  assert.equal(canceledOrderId, "order-1")
  assert.equal(canceledOrder.status, "canceled")
  assert.equal(invoiceFinancialState.status, "void")
  assert.equal(invoiceFinancialState.paidAmount, "0.00")
  assert.equal(invoiceFinancialState.remainingBalance, "1000.00")
  assert.ok(invoiceFinancialState.updatedAt instanceof Date)
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
    transaction: async (
      handler: (context: {
        db: unknown
        ordersRepository: unknown
      }) => Promise<unknown>
    ) => handler({ db: fakeDb, ordersRepository }),
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
    (() => ({})) as never
  )

  await assert.rejects(
    () => service.cancel("order-1", adminUser),
    InvoicePaymentLockError
  )
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
    (() => ({})) as never
  )

  await assert.rejects(
    () => service.archive("order-1", adminUser),
    OrderArchiveStatusError
  )
  assert.equal(archiveAttempted, false)
})

test("OrdersService.archive archives canceled orders", async () => {
  let archiveAttempted = false
  let order = buildOrder({
    status: "canceled",
    canceledAt: new Date("2026-04-24T09:00:00.000Z"),
  })
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
    (() => ({})) as never
  )

  const archivedOrder = await service.archive("order-1", adminUser)

  assert.equal(archiveAttempted, true)
  assert.equal(archivedOrder.archived_at, "2026-04-24T10:00:00.000Z")
})

test("OrdersService.substituteProductBundle supports a partially paid invoice without changing charged prices", async () => {
  const now = new Date("2026-07-31T03:00:00.000Z")
  const sourceBundle = {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Grecoopack cup + flat lid",
    description: null,
    cupId: "55555555-5555-4555-8555-555555555555",
    lidId: "66666666-6666-4666-8666-666666666666",
    cupQtyPerSet: 1,
    lidQtyPerSet: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  const targetBundle = {
    ...sourceBundle,
    id: "77777777-7777-4777-8777-777777777777",
    name: "Dabba cup + flat lid",
    cupId: "88888888-8888-4888-8888-888888888888",
  }
  let operationalItem = {
    id: "33333333-3333-4333-8333-333333333333",
    orderId: "99999999-9999-4999-8999-999999999999",
    itemType: "product_bundle" as const,
    cupId: null,
    lidId: null,
    nonStockItemId: null,
    productBundleId: sourceBundle.id,
    productBundle: sourceBundle,
    descriptionSnapshot: sourceBundle.name,
    quantity: 500,
    unitCostPrice: "5.00",
    unitSellPrice: "7.00",
    notes: null,
    progressEvents: [],
    bundleSubstitutions: [] as unknown[],
    createdAt: now,
    updatedAt: now,
  }
  const order = buildOrder({
    id: operationalItem.orderId,
    items: [operationalItem],
  })
  const inventoryCalls: unknown[] = []
  const auditRows: unknown[] = []
  let invoiceWriteAttempted = false
  const fakeDb = {
    query: {
      invoices: {
        findFirst: async () => ({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          orderId: operationalItem.orderId,
          status: "pending",
          paidAmount: "3400.00",
          items: [{ unitSellPrice: "7.00" }],
          payments: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }],
        }),
      },
    },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [targetBundle],
        }),
      }),
    }),
    update: () => {
      invoiceWriteAttempted = true
      throw new Error("Invoice mutation is forbidden")
    },
  }
  const ordersRepository = {
    transaction: async (
      handler: (context: {
        db: unknown
        ordersRepository: unknown
      }) => Promise<unknown>
    ) => handler({ db: fakeDb, ordersRepository }),
    lockOrderItem: async () => undefined,
    findOrderItemWithOrder: async () => ({
      ...operationalItem,
      order,
    }),
    updateOrderItemProductBundle: async (
      _id: string,
      input: { productBundleId: string; descriptionSnapshot: string }
    ) => {
      operationalItem = {
        ...operationalItem,
        productBundleId: input.productBundleId,
        productBundle: targetBundle,
        descriptionSnapshot: input.descriptionSnapshot,
        updatedAt: now,
      }
    },
    createOrderItemBundleSubstitution: async (
      input: Record<string, unknown>
    ) => {
      auditRows.push(input)
      operationalItem.bundleSubstitutions = [
        {
          ...input,
          sourceProductBundle: sourceBundle,
          targetProductBundle: targetBundle,
          createdByUser: adminUser,
          createdAt: now,
        },
      ]
    },
    findByIdWithRelations: async () => ({
      ...order,
      items: [operationalItem],
    }),
  }
  const service = new OrdersService(
    ordersRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    (() => ({
      substituteOrderItemReservations: async (input: unknown) => {
        inventoryCalls.push(input)
      },
    })) as never
  )

  const result = await service.substituteProductBundle(
    operationalItem.id,
    {
      target_product_bundle_id: targetBundle.id,
      reason: "Use the Dabba cup for production",
    },
    adminUser
  )
  const resultItem = result.items[0] as
    | {
        product_bundle: { id: string } | null
        description_snapshot: string
        unit_sell_price?: string
        unit_cost_price?: string
      }
    | undefined

  assert.equal(resultItem?.product_bundle?.id, targetBundle.id)
  assert.equal(resultItem?.description_snapshot, targetBundle.name)
  assert.equal(resultItem?.unit_sell_price, "7.00")
  assert.equal(resultItem?.unit_cost_price, "5.00")
  assert.equal(inventoryCalls.length, 1)
  assert.equal(auditRows.length, 1)
  assert.equal(invoiceWriteAttempted, false)
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
