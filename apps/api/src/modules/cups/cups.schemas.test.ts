import test from "node:test"
import assert from "node:assert/strict"

import { createCupRequestSchema } from "./cups.schemas.js"

test("createCupRequestSchema accepts a valid paper cup contract", () => {
  const result = createCupRequestSchema.parse({
    type: "paper",
    brand: "other_supplier",
    diameter: "80mm",
    size: "12oz",
    color: "kraft",
    min_stock: 25,
    cost_price: "10.50",
    default_sell_price: "15.75",
    is_active: true,
  })

  assert.deepEqual(result, {
    type: "paper",
    brand: "other_supplier",
    diameter: "80mm",
    size: "12oz",
    color: "kraft",
    minStock: 25,
    costPrice: "10.50",
    defaultSellPrice: "15.75",
    isActive: true,
  })
})

test("createCupRequestSchema rejects invalid plastic cup diameter for dabba", () => {
  assert.throws(
    () =>
      createCupRequestSchema.parse({
        type: "plastic",
        brand: "dabba",
        diameter: "98mm",
        size: "16oz",
        color: "transparent",
        min_stock: 0,
        cost_price: "0",
        default_sell_price: "0",
        is_active: true,
      }),
    /95mm/,
  )
})

test("createCupRequestSchema rejects a missing default sell price", () => {
  assert.throws(
    () =>
      createCupRequestSchema.parse({
        type: "paper",
        brand: "other_supplier",
        diameter: "80mm",
        size: "12oz",
        color: "kraft",
        min_stock: 25,
        cost_price: "10.50",
        is_active: true,
      }),
    /default_sell_price/,
  )
})
