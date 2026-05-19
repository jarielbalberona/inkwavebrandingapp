import test from "node:test"
import assert from "node:assert/strict"

import { ZodError } from "zod"

import {
  createOrderLineItemProgressEventSchema,
  createOrderSchema,
} from "./orders.schemas.js"

const validCustomerId = "11111111-1111-1111-1111-111111111111"

test("createOrderSchema accepts a valid product_bundle line item with override pricing", () => {
  const parsed = createOrderSchema.parse({
    customer_id: validCustomerId,
    line_items: [
      {
        item_type: "product_bundle",
        product_bundle_id: "22222222-2222-4222-8222-222222222222",
        quantity: 1000,
        unit_sell_price: "8.50",
      },
    ],
  })

  assert.deepEqual(parsed.line_items[0], {
    item_type: "product_bundle",
    product_bundle_id: "22222222-2222-4222-8222-222222222222",
    quantity: 1000,
    unit_sell_price: "8.50",
  })
})

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

test("createOrderLineItemProgressEventSchema accepts release planning details for ready_for_release", () => {
  const parsed = createOrderLineItemProgressEventSchema.parse({
    stage: "ready_for_release",
    quantity: 10,
    release_method: "office_pickup",
    staging_location: "Office shelf A",
    scheduled_release_date: "2026-05-20",
    event_date: "2026-05-19",
  })

  assert.equal(parsed.release_method, "office_pickup")
  assert.equal(parsed.staging_location, "Office shelf A")
  assert.ok(parsed.scheduled_release_date)
  assert.equal(
    parsed.scheduled_release_date.toISOString(),
    "2026-05-20T00:00:00.000Z"
  )
})

test("createOrderLineItemProgressEventSchema requires release method for released events", () => {
  assert.throws(
    () =>
      createOrderLineItemProgressEventSchema.parse({
        stage: "released",
        quantity: 10,
        event_date: "2026-05-19",
      }),
    (error: unknown) =>
      error instanceof ZodError &&
      error.issues.some(
        (issue) =>
          issue.path.join(".") === "release_method" &&
          issue.message ===
            "Release method is required when recording released events."
      )
  )
})

test("createOrderLineItemProgressEventSchema rejects release details before ready_for_release", () => {
  assert.throws(
    () =>
      createOrderLineItemProgressEventSchema.parse({
        stage: "packed",
        quantity: 10,
        release_method: "delivery",
        event_date: "2026-05-19",
      }),
    (error: unknown) =>
      error instanceof ZodError &&
      error.issues.some(
        (issue) =>
          issue.path.join(".") === "release_method" &&
          issue.message ===
            "Release handoff details are only allowed for ready_for_release or released events."
      )
  )
})
