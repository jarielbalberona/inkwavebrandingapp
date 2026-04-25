import test from "node:test"
import assert from "node:assert/strict"

import type { ProductBundle, SellableProductPriceRule } from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import {
  SellableProductPriceRulesService,
  SellableProductPriceRuleValidationError,
} from "./sellable-product-price-rules.service.js"

const productBundleId = "11111111-1111-4111-8111-111111111111"
const priceRuleId = "22222222-2222-4222-8222-222222222222"

const adminUser: SafeUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "admin@inkwave.test",
  displayName: "Admin",
  role: "admin",
  permissions: [],
}

function createProductBundle(overrides: Partial<ProductBundle> = {}): ProductBundle {
  return {
    id: productBundleId,
    name: "16oz PET Cup + Flat Lid",
    description: null,
    cupId: "44444444-4444-4444-8444-444444444444",
    lidId: "55555555-5555-4555-8555-555555555555",
    cupQtyPerSet: 1,
    lidQtyPerSet: 1,
    isActive: true,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    ...overrides,
  }
}

function createPriceRule(overrides: Partial<SellableProductPriceRule> = {}): SellableProductPriceRule {
  return {
    id: priceRuleId,
    productBundleId,
    minQty: 1,
    maxQty: 999,
    unitPrice: "6.50",
    isActive: true,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    ...overrides,
  }
}

test("SellableProductPriceRulesService creates rules for active bundles", async () => {
  const service = new SellableProductPriceRulesService(
    {
      list: async () => [],
      findById: async () => undefined,
      create: async () => createPriceRule(),
      update: async () => undefined,
    },
    {
      findById: async () => createProductBundle(),
    },
  )

  const result = await service.create(
    {
      productBundleId,
      minQty: 1,
      maxQty: 999,
      unitPrice: "6.50",
      isActive: true,
    },
    adminUser,
  )

  assert.equal(result.product_bundle_id, productBundleId)
  assert.equal(result.unit_price, "6.50")
})

test("SellableProductPriceRulesService rejects active rules for inactive bundles", async () => {
  const service = new SellableProductPriceRulesService(
    {
      list: async () => [],
      findById: async () => undefined,
      create: async () => createPriceRule(),
      update: async () => undefined,
    },
    {
      findById: async () => createProductBundle({ isActive: false }),
    },
  )

  await assert.rejects(
    () =>
      service.create(
        {
          productBundleId,
          minQty: 1,
          maxQty: 999,
          unitPrice: "6.50",
          isActive: true,
        },
        adminUser,
      ),
    SellableProductPriceRuleValidationError,
  )
})

test("SellableProductPriceRulesService allows inactive rules for inactive bundles", async () => {
  const service = new SellableProductPriceRulesService(
    {
      list: async () => [],
      findById: async () => undefined,
      create: async () => createPriceRule({ isActive: false }),
      update: async () => undefined,
    },
    {
      findById: async () => createProductBundle({ isActive: false }),
    },
  )

  const result = await service.create(
    {
      productBundleId,
      minQty: 1,
      maxQty: 999,
      unitPrice: "6.50",
      isActive: false,
    },
    adminUser,
  )

  assert.equal(result.is_active, false)
})
