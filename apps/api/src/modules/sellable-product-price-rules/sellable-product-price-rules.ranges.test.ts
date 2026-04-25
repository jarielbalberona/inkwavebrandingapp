import test from "node:test"
import assert from "node:assert/strict"

import {
  findMatchingActiveRange,
  findOverlappingRange,
  rangesOverlap,
} from "./sellable-product-price-rules.ranges.js"

test("rangesOverlap treats boundary contact as overlap", () => {
  assert.equal(rangesOverlap({ minQty: 1, maxQty: 999 }, { minQty: 999, maxQty: 1999 }), true)
})

test("rangesOverlap handles open-ended ranges", () => {
  assert.equal(rangesOverlap({ minQty: 2000, maxQty: null }, { minQty: 3000, maxQty: 3999 }), true)
  assert.equal(rangesOverlap({ minQty: 1, maxQty: 999 }, { minQty: 1000, maxQty: null }), false)
})

test("findOverlappingRange ignores the candidate id", () => {
  assert.equal(
    findOverlappingRange(
      { id: "rule-1", minQty: 1, maxQty: 999 },
      [{ id: "rule-1", minQty: 1, maxQty: 999 }],
    ),
    null,
  )
})

test("findMatchingActiveRange resolves a bounded range", () => {
  const result = findMatchingActiveRange(1000, [
    { id: "rule-1", minQty: 1, maxQty: 999 },
    { id: "rule-2", minQty: 1000, maxQty: 1999 },
    { id: "rule-3", minQty: 2000, maxQty: null },
  ])

  assert.equal(result?.id, "rule-2")
})

test("findMatchingActiveRange resolves an open-ended range", () => {
  const result = findMatchingActiveRange(2500, [
    { id: "rule-1", minQty: 1, maxQty: 999 },
    { id: "rule-2", minQty: 1000, maxQty: 1999 },
    { id: "rule-3", minQty: 2000, maxQty: null },
  ])

  assert.equal(result?.id, "rule-3")
})

test("findMatchingActiveRange returns null when no active rule matches", () => {
  assert.equal(findMatchingActiveRange(1000, [{ id: "rule-1", minQty: 1, maxQty: 999 }]), null)
})

test("findMatchingActiveRange rejects ambiguous active ranges", () => {
  assert.throws(
    () =>
      findMatchingActiveRange(1000, [
        { id: "rule-1", minQty: 1, maxQty: 1000 },
        { id: "rule-2", minQty: 1000, maxQty: 1999 },
      ]),
    /Multiple active price rules/,
  )
})
