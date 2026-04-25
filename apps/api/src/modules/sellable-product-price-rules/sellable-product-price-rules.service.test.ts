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
      listActiveByProductBundle: async () => [],
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
      listActiveByProductBundle: async () => [],
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
      listActiveByProductBundle: async () => [],
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

test("SellableProductPriceRulesService rejects overlapping active ranges", async () => {
  const service = new SellableProductPriceRulesService(
    {
      list: async () => [],
      findById: async () => undefined,
      listActiveByProductBundle: async () => [
        createPriceRule({
          id: "66666666-6666-4666-8666-666666666666",
          minQty: 1,
          maxQty: 999,
        }),
      ],
      create: async () => createPriceRule(),
      update: async () => undefined,
    },
    {
      findById: async () => createProductBundle(),
    },
  )

  await assert.rejects(
    () =>
      service.create(
        {
          productBundleId,
          minQty: 999,
          maxQty: 1999,
          unitPrice: "6.00",
          isActive: true,
        },
        adminUser,
      ),
    /overlaps existing active rule/,
  )
})

test("SellableProductPriceRulesService resolves default price rules by quantity", async () => {
  const service = new SellableProductPriceRulesService(
    {
      list: async () => [],
      findById: async () => undefined,
      listActiveByProductBundle: async () => [
        createPriceRule({
          id: "66666666-6666-4666-8666-666666666666",
          minQty: 1,
          maxQty: 999,
          unitPrice: "6.50",
        }),
        createPriceRule({
          id: "77777777-7777-4777-8777-777777777777",
          minQty: 1000,
          maxQty: 1999,
          unitPrice: "6.00",
        }),
        createPriceRule({
          id: "88888888-8888-4888-8888-888888888888",
          minQty: 2000,
          maxQty: null,
          unitPrice: "5.50",
        }),
      ],
      create: async () => createPriceRule(),
      update: async () => undefined,
    },
    {
      findById: async () => createProductBundle(),
    },
  )

  const result = await service.resolveDefaultPriceRule(
    {
      product_bundle_id: productBundleId,
      quantity: 2000,
    },
    adminUser,
  )

  assert.equal(result?.unit_price, "5.50")
})

test("SellableProductPriceRulesService returns null when no default rule matches", async () => {
  const service = new SellableProductPriceRulesService(
    {
      list: async () => [],
      findById: async () => undefined,
      listActiveByProductBundle: async () => [
        createPriceRule({
          minQty: 1,
          maxQty: 999,
        }),
      ],
      create: async () => createPriceRule(),
      update: async () => undefined,
    },
    {
      findById: async () => createProductBundle(),
    },
  )

  const result = await service.resolveDefaultPriceRule(
    {
      product_bundle_id: productBundleId,
      quantity: 1000,
    },
    adminUser,
  )

  assert.equal(result, null)
})
