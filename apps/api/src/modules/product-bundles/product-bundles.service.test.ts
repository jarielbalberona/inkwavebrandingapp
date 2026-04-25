import test from "node:test"
import assert from "node:assert/strict"

import type { ProductBundle } from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import {
  ProductBundlePersistenceValidationError,
  ProductBundlesService,
} from "./product-bundles.service.js"

const cupId = "11111111-1111-4111-8111-111111111111"
const lidId = "22222222-2222-4222-8222-222222222222"

const adminUser: SafeUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "admin@inkwave.test",
  displayName: "Admin",
  role: "admin",
  permissions: [],
}

function createProductBundle(overrides: Partial<ProductBundle> = {}): ProductBundle {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    name: "16oz PET Cup + Flat Lid",
    description: null,
    cupId,
    lidId,
    cupQtyPerSet: 1,
    lidQtyPerSet: 1,
    isActive: true,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    ...overrides,
  }
}

test("ProductBundlesService rejects active bundles with inactive cups", async () => {
  const service = new ProductBundlesService(
    {
      list: async () => [],
      findById: async () => undefined,
      create: async () => createProductBundle(),
      update: async () => undefined,
    },
    {
      findById: async () => ({ isActive: false }),
    },
    {
      findById: async () => ({ isActive: true }),
    },
  )

  await assert.rejects(
    () =>
      service.create(
        {
          name: "Inactive cup bundle",
          cupId,
          lidId,
          cupQtyPerSet: 1,
          lidQtyPerSet: 1,
          isActive: true,
        },
        adminUser,
      ),
    ProductBundlePersistenceValidationError,
  )
})

test("ProductBundlesService allows inactive bundles with inactive components", async () => {
  const service = new ProductBundlesService(
    {
      list: async () => [],
      findById: async () => undefined,
      create: async () => createProductBundle({ isActive: false }),
      update: async () => undefined,
    },
    {
      findById: async () => ({ isActive: false }),
    },
    {
      findById: async () => ({ isActive: false }),
    },
  )

  const result = await service.create(
    {
      name: "Inactive bundle",
      cupId,
      lidId,
      cupQtyPerSet: 1,
      lidQtyPerSet: 1,
      isActive: false,
    },
    adminUser,
  )

  assert.equal(result.is_active, false)
})

test("ProductBundlesService rejects reactivating a bundle with an inactive lid", async () => {
  const service = new ProductBundlesService(
    {
      list: async () => [],
      findById: async () => createProductBundle({ isActive: false }),
      create: async () => createProductBundle(),
      update: async () => undefined,
    },
    {
      findById: async () => ({ isActive: true }),
    },
    {
      findById: async () => ({ isActive: false }),
    },
  )

  await assert.rejects(
    () => service.update("44444444-4444-4444-8444-444444444444", { isActive: true }, adminUser),
    /inactive lids/,
  )
})
