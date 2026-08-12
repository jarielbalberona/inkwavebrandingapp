import assert from "node:assert/strict"
import test from "node:test"

import {
  inventoryMovementsQuerySchema,
  stockIntakeRequestSchema,
} from "./inventory.schemas.js"

const paperBowlId = "550e8400-e29b-41d4-a716-446655440000"

test("stock intake accepts a paper bowl reference", () => {
  const result = stockIntakeRequestSchema.parse({
    itemType: "paper_bowl",
    paperBowlId,
    quantity: 20,
  })

  assert.equal(result.paperBowlId, paperBowlId)
})

test("inventory movement filters reject mixed item references", () => {
  assert.throws(() =>
    inventoryMovementsQuerySchema.parse({
      item_type: "paper_bowl",
      paper_bowl_id: paperBowlId,
      cup_id: paperBowlId,
    }),
  )
})
