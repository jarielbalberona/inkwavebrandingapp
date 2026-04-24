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
    costPrice: "3.25",
    defaultSellPrice: "5.00",
    isActive: true,
  })
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
