import test from "node:test"
import assert from "node:assert/strict"

import { OrdersService } from "./orders.service.js"

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
