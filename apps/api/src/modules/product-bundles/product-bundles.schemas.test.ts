import test from "node:test"
import assert from "node:assert/strict"

import {
  createProductBundleRequestSchema,
  updateProductBundleRequestSchema,
} from "./product-bundles.schemas.js"

const cupId = "11111111-1111-4111-8111-111111111111"
const lidId = "22222222-2222-4222-8222-222222222222"

test("createProductBundleRequestSchema accepts a cup and lid bundle", () => {
  const result = createProductBundleRequestSchema.parse({
    name: "16oz PET Cup + Flat Lid",
    description: "Commercial set",
    cup_id: cupId,
    lid_id: lidId,
    cup_qty_per_set: 1,
    lid_qty_per_set: 1,
    is_active: true,
  })

  assert.deepEqual(result, {
    name: "16oz PET Cup + Flat Lid",
    description: "Commercial set",
    cupId,
    lidId,
    cupQtyPerSet: 1,
    lidQtyPerSet: 1,
    isActive: true,
  })
})

test("createProductBundleRequestSchema accepts a cup-only bundle", () => {
  const result = createProductBundleRequestSchema.parse({
    name: "16oz PET Cup only",
    cup_id: cupId,
    lid_id: null,
    cup_qty_per_set: 1,
    lid_qty_per_set: 0,
  })

  assert.equal(result.cupId, cupId)
  assert.equal(result.lidId, null)
  assert.equal(result.cupQtyPerSet, 1)
  assert.equal(result.lidQtyPerSet, 0)
  assert.equal(result.isActive, true)
})

test("createProductBundleRequestSchema accepts a null description", () => {
  const result = createProductBundleRequestSchema.parse({
    name: "16oz PET Cup only",
    description: null,
    cup_id: cupId,
    lid_id: null,
    cup_qty_per_set: 1,
    lid_qty_per_set: 0,
  })

  assert.equal(result.description, null)
})

test("updateProductBundleRequestSchema normalizes a blank description to null", () => {
  const result = updateProductBundleRequestSchema.parse({
    description: "   ",
  })

  assert.deepEqual(result, {
    description: null,
  })
})

test("createProductBundleRequestSchema rejects a bundle without inventory components", () => {
  assert.throws(
    () =>
      createProductBundleRequestSchema.parse({
        name: "Invalid bundle",
        cup_id: null,
        lid_id: null,
        cup_qty_per_set: 0,
        lid_qty_per_set: 0,
      }),
    /At least one cup or lid component is required/,
  )
})

test("createProductBundleRequestSchema rejects selected components without quantities", () => {
  assert.throws(
    () =>
      createProductBundleRequestSchema.parse({
        name: "Invalid cup bundle",
        cup_id: cupId,
        lid_id: null,
        cup_qty_per_set: 0,
        lid_qty_per_set: 0,
      }),
    /Cup quantity must be greater than 0/,
  )
})

test("createProductBundleRequestSchema rejects quantities without selected components", () => {
  assert.throws(
    () =>
      createProductBundleRequestSchema.parse({
        name: "Invalid lid quantity",
        cup_id: cupId,
        lid_id: null,
        cup_qty_per_set: 1,
        lid_qty_per_set: 1,
      }),
    /Lid quantity must be 0/,
  )
})

test("updateProductBundleRequestSchema accepts sparse non-composition updates", () => {
  const result = updateProductBundleRequestSchema.parse({
    name: "Updated Bundle Name",
  })

  assert.deepEqual(result, {
    name: "Updated Bundle Name",
  })
})
