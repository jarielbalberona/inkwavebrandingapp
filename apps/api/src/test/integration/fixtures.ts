import { randomUUID } from "node:crypto"

import * as schema from "../../db/schema/index.js"
import { getIntegrationDb } from "./harness.js"

function uniqueSuffix() {
  return randomUUID().slice(0, 8)
}

export async function seedCustomer(overrides: Partial<typeof schema.customers.$inferInsert> = {}) {
  const db = await getIntegrationDb()
  const suffix = uniqueSuffix()
  const [customer] = await db
    .insert(schema.customers)
    .values({
      customerCode: `CUST-${suffix}`.toUpperCase(),
      businessName: `Integration Customer ${suffix}`,
      contactPerson: "Integration Contact",
      contactNumber: "09170000000",
      email: `customer-${suffix}@inkwave.test`,
      address: "Integration Test Address",
      notes: "Integration fixture customer",
      isActive: true,
      ...overrides,
    })
    .returning()

  if (!customer) {
    throw new Error("Failed to seed customer")
  }

  return customer
}

export async function seedCup(overrides: Partial<typeof schema.cups.$inferInsert> = {}) {
  const db = await getIntegrationDb()
  const suffix = uniqueSuffix().toUpperCase()
  const [cup] = await db
    .insert(schema.cups)
    .values({
      sku: `INT-CUP-${suffix}`,
      type: "paper",
      brand: "other_supplier",
      diameter: "90mm",
      size: "12oz",
      color: "white",
      minStock: 10,
      costPrice: "8.50",
      defaultSellPrice: "15.00",
      isActive: true,
      ...overrides,
    })
    .returning()

  if (!cup) {
    throw new Error("Failed to seed cup")
  }

  return cup
}

export async function seedLid(overrides: Partial<typeof schema.lids.$inferInsert> = {}) {
  const db = await getIntegrationDb()
  const suffix = uniqueSuffix().toUpperCase()
  const [lid] = await db
    .insert(schema.lids)
    .values({
      sku: `INT-LID-${suffix}`,
      type: "plastic",
      brand: "china_supplier",
      diameter: "98mm",
      shape: "dome",
      color: "transparent",
      costPrice: "2.50",
      defaultSellPrice: "5.00",
      isActive: true,
      ...overrides,
    })
    .returning()

  if (!lid) {
    throw new Error("Failed to seed lid")
  }

  return lid
}

export async function seedNonStockItem(
  overrides: Partial<typeof schema.nonStockItems.$inferInsert> = {},
) {
  const db = await getIntegrationDb()
  const suffix = uniqueSuffix()
  const [item] = await db
    .insert(schema.nonStockItems)
    .values({
      name: `Integration General Item ${suffix}`,
      description: "Integration test general item",
      costPrice: "3.00",
      defaultSellPrice: "7.50",
      isActive: true,
      ...overrides,
    })
    .returning()

  if (!item) {
    throw new Error("Failed to seed non-stock item")
  }

  return item
}
