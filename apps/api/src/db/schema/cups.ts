import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const cups = pgTable(
  "cups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: varchar("sku", { length: 80 }).notNull(),
    brand: varchar("brand", { length: 160 }).notNull(),
    size: varchar("size", { length: 80 }).notNull(),
    dimension: varchar("dimension", { length: 120 }).notNull(),
    material: varchar("material", { length: 80 }),
    color: varchar("color", { length: 80 }),
    minStock: integer("min_stock").notNull().default(0),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull().default("0"),
    defaultSellPrice: numeric("default_sell_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cups_sku_unique_idx").on(sql`lower(${table.sku})`),
    check("cups_min_stock_non_negative", sql`${table.minStock} >= 0`),
    check("cups_cost_price_non_negative", sql`${table.costPrice} >= 0`),
    check("cups_default_sell_price_non_negative", sql`${table.defaultSellPrice} >= 0`),
    check("cups_sku_not_blank", sql`length(trim(${table.sku})) > 0`),
    check("cups_sku_normalized", sql`${table.sku} = upper(${table.sku})`),
    check("cups_sku_allowed_characters", sql`${table.sku} ~ '^[A-Z0-9][A-Z0-9_-]{0,79}$'`),
    check("cups_brand_not_blank", sql`length(trim(${table.brand})) > 0`),
    check("cups_size_not_blank", sql`length(trim(${table.size})) > 0`),
    check("cups_dimension_not_blank", sql`length(trim(${table.dimension})) > 0`),
  ],
)

export type Cup = typeof cups.$inferSelect
export type NewCup = typeof cups.$inferInsert
