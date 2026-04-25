import test from "node:test"
import assert from "node:assert/strict"

import {
  getProductBundleCompositionIssues,
  toProductBundleInventoryComponents,
} from "./product-bundles.composition.js"

const cupId = "11111111-1111-4111-8111-111111111111"
const lidId = "22222222-2222-4222-8222-222222222222"

test("getProductBundleCompositionIssues accepts cup and lid composition", () => {
  assert.deepEqual(
    getProductBundleCompositionIssues({
      cupId,
      lidId,
      cupQtyPerSet: 1,
      lidQtyPerSet: 1,
    }),
    [],
  )
})

test("getProductBundleCompositionIssues rejects empty composition", () => {
  assert.deepEqual(
    getProductBundleCompositionIssues({
      cupId: null,
      lidId: null,
      cupQtyPerSet: 0,
      lidQtyPerSet: 0,
    }),
    ["At least one cup or lid component is required."],
  )
})

test("getProductBundleCompositionIssues rejects component and quantity mismatches", () => {
  assert.deepEqual(
    getProductBundleCompositionIssues({
      cupId,
      lidId: null,
      cupQtyPerSet: 0,
      lidQtyPerSet: 1,
    }),
    [
      "Cup quantity must be greater than 0 when a cup is selected.",
      "Lid quantity must be 0 when no lid is selected.",
    ],
  )
})

test("toProductBundleInventoryComponents expands per-set quantities for inventory effects", () => {
  assert.deepEqual(
    toProductBundleInventoryComponents(
      {
        cupId,
        lidId,
        cupQtyPerSet: 1,
        lidQtyPerSet: 2,
      },
      3,
    ),
    [
      {
        itemType: "cup",
        itemId: cupId,
        quantity: 3,
      },
      {
        itemType: "lid",
        itemId: lidId,
        quantity: 6,
      },
    ],
  )
})

test("toProductBundleInventoryComponents rejects invalid set quantities", () => {
  assert.throws(
    () =>
      toProductBundleInventoryComponents(
        {
          cupId,
          lidId: null,
          cupQtyPerSet: 1,
          lidQtyPerSet: 0,
        },
        0,
      ),
    /positive integer/,
  )
})
