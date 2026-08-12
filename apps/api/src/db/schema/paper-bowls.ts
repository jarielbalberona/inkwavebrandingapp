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

export const paperBowlSizeEnum = pgEnum("paper_bowl_size", [
  "220cc",
  "320cc",
  "390cc",
  "520cc",
  "750cc",
])
export const paperBowlColorEnum = pgEnum("paper_bowl_color", ["white", "kraft"])

export const paperBowls = pgTable(
  "paper_bowls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: varchar("sku", { length: 80 }).notNull(),
    supplier: varchar("supplier", { length: 40 }).notNull().default("other_supplier"),
    size: paperBowlSizeEnum("size").notNull(),
    color: paperBowlColorEnum("color").notNull(),
    diameterMm: integer("diameter_mm"),
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
    uniqueIndex("paper_bowls_sku_unique_idx").on(sql`lower(${table.sku})`),
    uniqueIndex("paper_bowls_identity_unique_idx").on(table.size, table.color),
    check("paper_bowls_supplier_contract", sql`${table.supplier} = 'other_supplier'`),
    check("paper_bowls_diameter_positive", sql`${table.diameterMm} IS NULL OR ${table.diameterMm} > 0`),
    check("paper_bowls_min_stock_non_negative", sql`${table.minStock} >= 0`),
    check("paper_bowls_cost_price_non_negative", sql`${table.costPrice} >= 0`),
    check("paper_bowls_default_sell_price_non_negative", sql`${table.defaultSellPrice} >= 0`),
    check("paper_bowls_sku_not_blank", sql`length(trim(${table.sku})) > 0`),
    check("paper_bowls_sku_normalized", sql`${table.sku} = upper(${table.sku})`),
    check("paper_bowls_sku_allowed_characters", sql`${table.sku} ~ '^[A-Z0-9][A-Z0-9_-]{0,79}$'`),
  ],
)

export type PaperBowl = typeof paperBowls.$inferSelect
export type NewPaperBowl = typeof paperBowls.$inferInsert
