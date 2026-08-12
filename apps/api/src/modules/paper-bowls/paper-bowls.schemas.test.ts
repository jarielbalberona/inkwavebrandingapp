import assert from "node:assert/strict"
import test from "node:test"

import {
  formatPaperBowlName,
  generatePaperBowlSku,
  paperBowlColors,
  paperBowlSizes,
} from "./paper-bowls.contract.js"
import { createPaperBowlRequestSchema } from "./paper-bowls.schemas.js"

test("paper bowl contract covers every requested size and color", () => {
  const variants = paperBowlSizes.flatMap((size) =>
    paperBowlColors.map((color) => ({ size, color })),
  )

  assert.equal(variants.length, 10)
  assert.equal(formatPaperBowlName(variants[0]!), "220cc White Paper Bowl")
  assert.equal(
    generatePaperBowlSku(variants[0]!),
    "220CC-PAPER-BOWL-OTHSPLR-WHT",
  )
  assert.equal(
    generatePaperBowlSku(variants.at(-1)!),
    "750CC-PAPER-BOWL-OTHSPLR-KRFT",
  )
})

test("paper bowl creation accepts nullable diameter and the temporary price", () => {
  assert.deepEqual(
    createPaperBowlRequestSchema.parse({
      size: "390cc",
      color: "kraft",
      diameter_mm: null,
      min_stock: 0,
      cost_price: "0.00",
      default_sell_price: "5.00",
      is_active: true,
    }),
    {
      size: "390cc",
      color: "kraft",
      diameterMm: null,
      minStock: 0,
      costPrice: "0.00",
      defaultSellPrice: "5.00",
      isActive: true,
    },
  )
})
