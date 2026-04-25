import assert from "node:assert/strict"
import test from "node:test"

import {
  InventoryReservationInsufficientStockError,
  InventoryService,
} from "./inventory.service.js"

function createInventoryService(input: {
  onHand: number
  reserved: number
}) {
  const movements: unknown[] = []
  const repository = {
    transaction: async (handler: (repository: unknown) => Promise<unknown>) =>
      handler(repository),
    toBalanceReference: (item: { itemType: "cup" | "lid"; cupId?: string; lidId?: string }) =>
      item.itemType === "cup"
        ? { itemType: "cup" as const, cupId: item.cupId! }
        : { itemType: "lid" as const, lidId: item.lidId! },
    getBalanceByItem: async (reference: { itemType: "cup" | "lid" }) => ({
      itemType: reference.itemType,
      cup: null,
      lid: null,
      onHand: input.onHand,
      reserved: input.reserved,
    }),
    appendMovement: async (movement: unknown) => {
      movements.push(movement)
      return movement
    },
  }
  const cupsRepository = {
    findById: async () => ({ isActive: true }),
  }
  const lidsRepository = {
    findById: async () => ({ isActive: true }),
  }

  return {
    service: new InventoryService(
      repository as never,
      cupsRepository as never,
      lidsRepository as never,
    ),
    movements,
  }
}

test("InventoryService.reserveOrderItems rejects reservations above available stock before writing movements", async () => {
  const { service, movements } = createInventoryService({ onHand: 10, reserved: 5 })

  await assert.rejects(
    () =>
      service.reserveOrderItems({
        orderId: "11111111-1111-4111-8111-111111111111",
        createdByUserId: "22222222-2222-4222-8222-222222222222",
        items: [
          {
            orderItemId: "33333333-3333-4333-8333-333333333333",
            itemType: "cup",
            cupId: "44444444-4444-4444-8444-444444444444",
            quantity: 6,
          },
        ],
      }),
    InventoryReservationInsufficientStockError,
  )

  assert.deepEqual(movements, [])
})

test("InventoryService.reserveOrderItems aggregates same-component reservation requests before stock check", async () => {
  const { service, movements } = createInventoryService({ onHand: 10, reserved: 0 })

  await assert.rejects(
    () =>
      service.reserveOrderItems({
        orderId: "11111111-1111-4111-8111-111111111111",
        items: [
          {
            orderItemId: "33333333-3333-4333-8333-333333333333",
            itemType: "lid",
            lidId: "44444444-4444-4444-8444-444444444444",
            quantity: 6,
          },
          {
            orderItemId: "55555555-5555-4555-8555-555555555555",
            itemType: "lid",
            lidId: "44444444-4444-4444-8444-444444444444",
            quantity: 5,
          },
        ],
      }),
    InventoryReservationInsufficientStockError,
  )

  assert.deepEqual(movements, [])
})
