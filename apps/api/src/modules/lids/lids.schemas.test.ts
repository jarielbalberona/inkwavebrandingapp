import test from "node:test"
import assert from "node:assert/strict"

import { createLidRequestSchema } from "./lids.schemas.js"

test("createLidRequestSchema accepts a valid plastic lid contract", () => {
  const result = createLidRequestSchema.parse({
    type: "plastic",
    brand: "grecoopack",
    diameter: "95mm",
    shape: "dome",
    color: "transparent",
    min_stock: 25,
    cost_price: "3.25",
    default_sell_price: "5.00",
    is_active: true,
  })

  assert.deepEqual(result, {
    type: "plastic",
    brand: "grecoopack",
    diameter: "95mm",
    shape: "dome",
    color: "transparent",
    minStock: 25,
    costPrice: "3.25",
    defaultSellPrice: "5.00",
    isActive: true,
  })
})

test("createLidRequestSchema accepts black plastic lids for Brand 1 and other supplier", () => {
  for (const brand of ["brand_1", "other_supplier"] as const) {
    const result = createLidRequestSchema.parse({
      type: "plastic",
      brand,
      diameter: "95mm",
      shape: "flat",
      color: "black",
      min_stock: 25,
      cost_price: "3.25",
      default_sell_price: "5.00",
      is_active: true,
    })

    assert.equal(result.brand, brand)
    assert.equal(result.color, "black")
  }
})

test("createLidRequestSchema rejects black plastic lids for Dabba and Grecoopack", () => {
  for (const brand of ["dabba", "grecoopack"] as const) {
    assert.throws(
      () =>
        createLidRequestSchema.parse({
          type: "plastic",
          brand,
          diameter: "95mm",
          shape: "flat",
          color: "black",
          min_stock: 25,
          cost_price: "3.25",
          default_sell_price: "5.00",
          is_active: true,
        }),
      /must be transparent/,
    )
  }
})

test("createLidRequestSchema rejects invalid paper lid color", () => {
  assert.throws(
    () =>
      createLidRequestSchema.parse({
        type: "paper",
        brand: "other_supplier",
        diameter: "80mm",
        shape: "coffee_lid",
        color: "transparent",
        min_stock: 0,
        cost_price: "2.00",
        default_sell_price: "4.00",
        is_active: true,
      }),
    /black or white/,
  )
})

test("createLidRequestSchema rejects a missing default sell price", () => {
  assert.throws(
    () =>
      createLidRequestSchema.parse({
        type: "plastic",
        brand: "grecoopack",
        diameter: "95mm",
        shape: "dome",
        color: "transparent",
        cost_price: "3.25",
        is_active: true,
      }),
    /default_sell_price/,
  )
})
