import test from "node:test"
import assert from "node:assert/strict"

import { calculateAvailable, getMovementDelta } from "./inventory.rules.js"

test("getMovementDelta applies reserve and consume semantics correctly", () => {
  assert.deepEqual(getMovementDelta("reserve", 12), { onHand: 0, reserved: 12 })
  assert.deepEqual(getMovementDelta("consume", 5), { onHand: -5, reserved: -5 })
  assert.deepEqual(getMovementDelta("release_reservation", 3), { onHand: 0, reserved: -3 })
})

test("calculateAvailable subtracts reserved stock from on hand", () => {
  assert.equal(calculateAvailable(120, 45), 75)
})
