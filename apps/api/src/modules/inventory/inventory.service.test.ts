import assert from "node:assert/strict"
import test from "node:test"

import {
  InventoryReservationStateMismatchError,
  InventoryService,
} from "./inventory.service.js"

function createInventoryService(input: {
  onHand: number
  reserved: number
  outstandingReservations?: unknown[]
}) {
  const movements: unknown[] = []
  const repository = {
    transaction: async (handler: (repository: unknown) => Promise<unknown>) =>
      handler(repository),
    toBalanceReference: (item: {
      itemType: "cup" | "lid"
      cupId?: string
      lidId?: string
    }) =>
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
    getOutstandingReservationsForOrderItem: async () =>
      input.outstandingReservations ?? [],
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
      lidsRepository as never
    ),
    movements,
  }
}

test("InventoryService.reserveOrderItems allows reservations above available stock", async () => {
  const { service, movements } = createInventoryService({
    onHand: 10,
    reserved: 5,
  })

  await service.reserveOrderItems({
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
  })

  assert.deepEqual(movements, [
    {
      itemType: "cup",
      cupId: "44444444-4444-4444-8444-444444444444",
      lidId: undefined,
      movementType: "reserve",
      quantity: 6,
      orderId: "11111111-1111-4111-8111-111111111111",
      orderItemId: "33333333-3333-4333-8333-333333333333",
      note: "Reserved for pending order",
      reference: "11111111-1111-4111-8111-111111111111",
      createdByUserId: "22222222-2222-4222-8222-222222222222",
    },
  ])
})

test("InventoryService.reserveOrderItems writes each same-component reservation request", async () => {
  const { service, movements } = createInventoryService({
    onHand: 10,
    reserved: 0,
  })

  await service.reserveOrderItems({
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
  })

  assert.equal(movements.length, 2)
})

test("InventoryService.substituteOrderItemReservations releases the exact source reservation before reserving the target", async () => {
  const sourceCupId = "44444444-4444-4444-8444-444444444444"
  const targetCupId = "55555555-5555-4555-8555-555555555555"
  const lidId = "66666666-6666-4666-8666-666666666666"
  const { service, movements } = createInventoryService({
    onHand: 0,
    reserved: 0,
    outstandingReservations: [
      { itemType: "cup", cupId: sourceCupId, quantity: 500 },
      { itemType: "lid", lidId, quantity: 500 },
    ],
  })

  await service.substituteOrderItemReservations({
    orderId: "11111111-1111-4111-8111-111111111111",
    orderItemId: "33333333-3333-4333-8333-333333333333",
    createdByUserId: "22222222-2222-4222-8222-222222222222",
    substitutionId: "77777777-7777-4777-8777-777777777777",
    sourceItems: [
      { itemType: "cup", cupId: sourceCupId, quantity: 500 },
      { itemType: "lid", lidId, quantity: 500 },
    ],
    targetItems: [
      { itemType: "cup", cupId: targetCupId, quantity: 500 },
      { itemType: "lid", lidId, quantity: 500 },
    ],
  })

  assert.deepEqual(
    movements.map((movement) => ({
      movementType: (movement as { movementType: string }).movementType,
      itemType: (movement as { itemType: string }).itemType,
      cupId: (movement as { cupId?: string }).cupId,
      lidId: (movement as { lidId?: string }).lidId,
      quantity: (movement as { quantity: number }).quantity,
    })),
    [
      {
        movementType: "release_reservation",
        itemType: "cup",
        cupId: sourceCupId,
        lidId: undefined,
        quantity: 500,
      },
      {
        movementType: "release_reservation",
        itemType: "lid",
        cupId: undefined,
        lidId,
        quantity: 500,
      },
      {
        movementType: "reserve",
        itemType: "cup",
        cupId: targetCupId,
        lidId: undefined,
        quantity: 500,
      },
      {
        movementType: "reserve",
        itemType: "lid",
        cupId: undefined,
        lidId,
        quantity: 500,
      },
    ]
  )
})

test("InventoryService.substituteOrderItemReservations rejects ledger drift before writing movements", async () => {
  const { service, movements } = createInventoryService({
    onHand: 10,
    reserved: 5,
    outstandingReservations: [
      {
        itemType: "cup",
        cupId: "44444444-4444-4444-8444-444444444444",
        quantity: 499,
      },
    ],
  })

  await assert.rejects(
    () =>
      service.substituteOrderItemReservations({
        orderId: "11111111-1111-4111-8111-111111111111",
        orderItemId: "33333333-3333-4333-8333-333333333333",
        substitutionId: "77777777-7777-4777-8777-777777777777",
        sourceItems: [
          {
            itemType: "cup",
            cupId: "44444444-4444-4444-8444-444444444444",
            quantity: 500,
          },
        ],
        targetItems: [
          {
            itemType: "cup",
            cupId: "55555555-5555-4555-8555-555555555555",
            quantity: 500,
          },
        ],
      }),
    InventoryReservationStateMismatchError
  )
  assert.deepEqual(movements, [])
})
