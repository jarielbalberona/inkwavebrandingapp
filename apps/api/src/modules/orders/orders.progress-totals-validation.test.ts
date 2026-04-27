import test from "node:test"
import assert from "node:assert/strict"

import {
  OrderProgressValidationError,
  validateProgressTotals,
} from "./orders.service.js"
import type { ProgressTotalsDto } from "./orders.types.js"

function baseTotals(
  overrides: Partial<ProgressTotalsDto> = {}
): ProgressTotalsDto {
  return {
    line_item_status: "not_started",
    total_printed: 0,
    total_qa_passed: 0,
    total_packed: 0,
    total_ready_for_release: 0,
    total_released: 0,
    remaining_balance: 10,
    ...overrides,
  }
}

test("product_bundle lid component allows packed progress before any QA", () => {
  assert.doesNotThrow(() =>
    validateProgressTotals(
      "product_bundle",
      10,
      baseTotals({
        total_packed: 4,
        total_qa_passed: 0,
        total_printed: 0,
      }),
      "lid"
    )
  )
})

test("product_bundle cup component still enforces QA within printed", () => {
  assert.throws(
    () =>
      validateProgressTotals(
        "product_bundle",
        10,
        baseTotals({
          total_printed: 2,
          total_qa_passed: 5,
        }),
        "cup"
      ),
    (error) =>
      error instanceof OrderProgressValidationError &&
      /QA passed quantity cannot exceed printed quantity/.test(error.message)
  )
})

test("product_bundle without component selection is rejected", () => {
  assert.throws(
    () => validateProgressTotals("product_bundle", 10, baseTotals()),
    (error) =>
      error instanceof OrderProgressValidationError &&
      /Product bundle progress requires a valid component item type/.test(
        error.message
      )
  )
})

test("cup line item still requires packed to stay within QA passed", () => {
  assert.throws(
    () =>
      validateProgressTotals(
        "cup",
        10,
        baseTotals({
          total_printed: 10,
          total_qa_passed: 10,
          total_packed: 11,
        })
      ),
    (error) =>
      error instanceof OrderProgressValidationError &&
      /Packed quantity cannot exceed QA passed quantity/.test(error.message)
  )
})
