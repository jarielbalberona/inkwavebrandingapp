import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { cups } from "./cups.js"
import { lids } from "./lids.js"

export const productBundles = pgTable(
  "product_bundles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description"),
    cupId: uuid("cup_id").references(() => cups.id, { onDelete: "restrict" }),
    lidId: uuid("lid_id").references(() => lids.id, { onDelete: "restrict" }),
    cupQtyPerSet: integer("cup_qty_per_set").notNull().default(0),
    lidQtyPerSet: integer("lid_qty_per_set").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_bundles_name_unique_idx").on(sql`lower(${table.name})`),
    index("product_bundles_cup_id_idx").on(table.cupId),
    index("product_bundles_lid_id_idx").on(table.lidId),
    index("product_bundles_is_active_idx").on(table.isActive),
    check("product_bundles_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check("product_bundles_cup_qty_per_set_non_negative", sql`${table.cupQtyPerSet} >= 0`),
    check("product_bundles_lid_qty_per_set_non_negative", sql`${table.lidQtyPerSet} >= 0`),
    check(
      "product_bundles_has_component",
      sql`${table.cupId} IS NOT NULL OR ${table.lidId} IS NOT NULL`,
    ),
    check(
      "product_bundles_cup_qty_matches_component",
      sql`(
        (${table.cupId} IS NULL AND ${table.cupQtyPerSet} = 0)
        OR
        (${table.cupId} IS NOT NULL AND ${table.cupQtyPerSet} > 0)
      )`,
    ),
    check(
      "product_bundles_lid_qty_matches_component",
      sql`(
        (${table.lidId} IS NULL AND ${table.lidQtyPerSet} = 0)
        OR
        (${table.lidId} IS NOT NULL AND ${table.lidQtyPerSet} > 0)
      )`,
    ),
  ],
)

export const productBundlesRelations = relations(productBundles, ({ one }) => ({
  cup: one(cups, {
    fields: [productBundles.cupId],
    references: [cups.id],
  }),
  lid: one(lids, {
    fields: [productBundles.lidId],
    references: [lids.id],
  }),
}))

export type ProductBundle = typeof productBundles.$inferSelect
export type NewProductBundle = typeof productBundles.$inferInsert
