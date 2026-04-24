import test from "node:test"
import assert from "node:assert/strict"

import { findStaffRestrictedKeys } from "../auth/role-safe-response.js"
import { toOrderDto } from "./orders.types.js"

const order = {
  id: "22222222-2222-2222-2222-222222222222",
  orderNumber: "ORD-001",
  priority: 2,
  status: "pending",
  notes: null,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z"),
  customer: {
    id: "11111111-1111-1111-1111-111111111111",
    customerCode: "CUST-001",
    businessName: "Ink Wave Cafe",
    contactPerson: "Jane Doe",
    contactNumber: "09170000000",
    email: "jane@example.com",
    address: "Manila",
    notes: null,
    isActive: true,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-02T00:00:00.000Z"),
  },
  items: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      itemType: "cup",
      cup: {
        id: "44444444-4444-4444-4444-444444444444",
        sku: "CUP-001",
        type: "paper",
        brand: "other_supplier",
        diameter: "80mm",
        size: "12oz",
        color: "kraft",
      },
      lid: null,
      descriptionSnapshot: "12oz kraft paper cup",
      quantity: 100,
      notes: null,
      unitCostPrice: "10.00",
      unitSellPrice: "15.00",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    },
  ],
} as const

test("toOrderDto hides line-item pricing for staff", () => {
  const dto = toOrderDto(order as never, {
    id: "55555555-5555-5555-5555-555555555555",
    email: "staff@example.com",
    displayName: "Staff",
    role: "staff",
  })

  assert.equal("unit_cost_price" in dto.items[0], false)
  assert.equal("unit_sell_price" in dto.items[0], false)
  assert.deepEqual(findStaffRestrictedKeys(dto), [])
})

test("toOrderDto includes line-item pricing for admin", () => {
  const dto = toOrderDto(order as never, {
    id: "66666666-6666-6666-6666-666666666666",
    email: "admin@example.com",
    displayName: "Admin",
    role: "admin",
  })

  assert.equal("unit_cost_price" in dto.items[0], true)
  assert.equal("unit_sell_price" in dto.items[0], true)
})
