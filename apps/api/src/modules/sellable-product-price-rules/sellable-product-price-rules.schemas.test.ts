import test from "node:test"
import assert from "node:assert/strict"

import {
  createSellableProductPriceRuleRequestSchema,
  updateSellableProductPriceRuleRequestSchema,
} from "./sellable-product-price-rules.schemas.js"

const productBundleId = "11111111-1111-4111-8111-111111111111"

test("createSellableProductPriceRuleRequestSchema accepts bounded pricing tiers", () => {
  const result = createSellableProductPriceRuleRequestSchema.parse({
    product_bundle_id: productBundleId,
    min_qty: 1,
    max_qty: 999,
    unit_price: "6.50",
    is_active: true,
  })

  assert.deepEqual(result, {
    productBundleId,
    minQty: 1,
    maxQty: 999,
    unitPrice: "6.50",
    isActive: true,
  })
})

test("createSellableProductPriceRuleRequestSchema accepts open-ended pricing tiers", () => {
  const result = createSellableProductPriceRuleRequestSchema.parse({
    product_bundle_id: productBundleId,
    min_qty: 2000,
    max_qty: null,
    unit_price: "5.50",
  })

  assert.equal(result.maxQty, null)
  assert.equal(result.isActive, true)
})

test("createSellableProductPriceRuleRequestSchema rejects invalid ranges", () => {
  assert.throws(
    () =>
      createSellableProductPriceRuleRequestSchema.parse({
        product_bundle_id: productBundleId,
        min_qty: 1000,
        max_qty: 999,
        unit_price: "6.00",
      }),
    /Maximum quantity/,
  )
})

test("createSellableProductPriceRuleRequestSchema rejects invalid unit prices", () => {
  assert.throws(
    () =>
      createSellableProductPriceRuleRequestSchema.parse({
        product_bundle_id: productBundleId,
        min_qty: 1,
        max_qty: 999,
        unit_price: "6.999",
      }),
    /money amount/,
  )
})

test("updateSellableProductPriceRuleRequestSchema accepts sparse updates", () => {
  assert.deepEqual(
    updateSellableProductPriceRuleRequestSchema.parse({
      unit_price: "6.25",
    }),
    {
      unitPrice: "6.25",
    },
  )
})
