import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { productBundles } from "./product-bundles.js"

export const sellableProductPriceRules = pgTable(
  "sellable_product_price_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productBundleId: uuid("product_bundle_id")
      .notNull()
      .references(() => productBundles.id, { onDelete: "restrict" }),
    minQty: integer("min_qty").notNull(),
    maxQty: integer("max_qty"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sellable_price_rules_bundle_id_idx").on(table.productBundleId),
    index("sellable_price_rules_active_idx").on(table.isActive),
    index("sellable_price_rules_bundle_active_min_idx").on(
      table.productBundleId,
      table.isActive,
      table.minQty,
    ),
    check("sellable_price_rules_min_qty_positive", sql`${table.minQty} > 0`),
    check(
      "sellable_price_rules_max_qty_valid",
      sql`${table.maxQty} IS NULL OR ${table.maxQty} >= ${table.minQty}`,
    ),
    check("sellable_price_rules_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
  ],
)

export const sellableProductPriceRulesRelations = relations(
  sellableProductPriceRules,
  ({ one }) => ({
    productBundle: one(productBundles, {
      fields: [sellableProductPriceRules.productBundleId],
      references: [productBundles.id],
    }),
  }),
)

export type SellableProductPriceRule = typeof sellableProductPriceRules.$inferSelect
export type NewSellableProductPriceRule = typeof sellableProductPriceRules.$inferInsert
