import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const cupTypeEnum = pgEnum("cup_type", ["paper", "plastic"])
export const cupBrandEnum = pgEnum("cup_brand", [
  "dabba",
  "grecoopack",
  "brand_1",
  "other_supplier",
])
export const cupDiameterEnum = pgEnum("cup_diameter", ["80mm", "90mm", "95mm", "98mm"])
export const cupSizeEnum = pgEnum("cup_size", ["6.5oz", "8oz", "12oz", "16oz", "20oz", "22oz"])
export const cupColorEnum = pgEnum("cup_color", ["transparent", "black", "white", "kraft"])

export const cups = pgTable(
  "cups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: varchar("sku", { length: 80 }).notNull(),
    type: cupTypeEnum("type").notNull(),
    brand: cupBrandEnum("brand").notNull(),
    diameter: cupDiameterEnum("diameter").notNull(),
    size: cupSizeEnum("size").notNull(),
    color: cupColorEnum("color").notNull(),
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
    check(
      "cups_type_brand_contract",
      sql`(
        (${table.type} = 'paper' AND ${table.brand} = 'other_supplier')
        OR
        (${table.type} = 'plastic')
      )`,
    ),
    check(
      "cups_type_diameter_contract",
      sql`(
        (${table.type} = 'paper' AND ${table.diameter} IN ('80mm', '90mm'))
        OR
        (
          ${table.type} = 'plastic'
          AND ${table.brand} IN ('dabba', 'grecoopack')
          AND ${table.diameter} = '95mm'
        )
        OR
        (
          ${table.type} = 'plastic'
          AND ${table.brand} IN ('brand_1', 'other_supplier')
          AND ${table.diameter} IN ('95mm', '98mm')
        )
      )`,
    ),
    check(
      "cups_type_size_contract",
      sql`(
        (${table.type} = 'paper' AND ${table.size} IN ('6.5oz', '8oz', '12oz', '16oz'))
        OR
        (${table.type} = 'plastic' AND ${table.size} IN ('12oz', '16oz', '20oz', '22oz'))
      )`,
    ),
    check(
      "cups_type_color_contract",
      sql`(
        (${table.type} = 'paper' AND ${table.color} IN ('white', 'black', 'kraft'))
        OR
        (
          ${table.type} = 'plastic'
          AND ${table.brand} IN ('dabba', 'grecoopack')
          AND ${table.color} = 'transparent'
        )
        OR
        (
          ${table.type} = 'plastic'
          AND ${table.brand} IN ('brand_1', 'other_supplier')
          AND ${table.color} IN ('transparent', 'black')
        )
      )`,
    ),
  ],
)

export type Cup = typeof cups.$inferSelect
export type NewCup = typeof cups.$inferInsert
