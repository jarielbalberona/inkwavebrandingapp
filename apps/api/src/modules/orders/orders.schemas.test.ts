import test from "node:test"
import assert from "node:assert/strict"

import { ZodError } from "zod"

import { createOrderSchema } from "./orders.schemas.js"

const validCustomerId = "11111111-1111-1111-1111-111111111111"

test("createOrderSchema accepts a valid custom_charge line item", () => {
  const parsed = createOrderSchema.parse({
    customer_id: validCustomerId,
    line_items: [
      {
        item_type: "custom_charge",
        description_snapshot: "Rush fee",
        quantity: 1,
        unit_sell_price: "500.00",
        unit_cost_price: "120.00",
        notes: "Same-day turnaround",
      },
    ],
  })

  assert.deepEqual(parsed.line_items[0], {
    item_type: "custom_charge",
    description_snapshot: "Rush fee",
    quantity: 1,
    unit_sell_price: "500.00",
    unit_cost_price: "120.00",
    notes: "Same-day turnaround",
  })
})

test("createOrderSchema rejects custom_charge without a description snapshot", () => {
  assert.throws(
    () =>
      createOrderSchema.parse({
        customer_id: validCustomerId,
        line_items: [
          {
            item_type: "custom_charge",
            description_snapshot: "   ",
            quantity: 1,
            unit_sell_price: "500.00",
          },
        ],
      }),
    (error: unknown) =>
      error instanceof ZodError &&
      error.issues.some(
        (issue) =>
          issue.path.join(".") === "line_items.0.description_snapshot" &&
          issue.message === "String must contain at least 1 character(s)",
      ),
  )
})

test("createOrderSchema rejects negative custom_charge sell pricing", () => {
  assert.throws(
    () =>
      createOrderSchema.parse({
        customer_id: validCustomerId,
        line_items: [
          {
            item_type: "custom_charge",
            description_snapshot: "Rush fee",
            quantity: 1,
            unit_sell_price: "-1.00",
          },
        ],
      }),
    (error: unknown) =>
      error instanceof ZodError &&
      error.issues.some(
        (issue) =>
          issue.path.join(".") === "line_items.0.unit_sell_price" &&
          issue.message === "Must be a valid non-negative money amount",
      ),
  )
})
