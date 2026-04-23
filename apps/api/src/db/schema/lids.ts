import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

export const lidTypeEnum = pgEnum("lid_type", ["paper", "plastic"])
export const lidBrandEnum = pgEnum("lid_brand", [
  "dabba",
  "grecoopack",
  "china_supplier",
  "other_supplier",
])
export const lidDiameterEnum = pgEnum("lid_diameter", ["80mm", "90mm", "95mm", "98mm"])
export const lidShapeEnum = pgEnum("lid_shape", [
  "dome",
  "flat",
  "strawless",
  "coffee_lid",
  "tall_lid",
])
export const lidColorEnum = pgEnum("lid_color", ["transparent", "black", "white"])

export const lids = pgTable(
  "lids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: lidTypeEnum("type").notNull(),
    brand: lidBrandEnum("brand").notNull(),
    diameter: lidDiameterEnum("diameter").notNull(),
    shape: lidShapeEnum("shape").notNull(),
    color: lidColorEnum("color").notNull(),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull().default("0"),
    defaultSellPrice: numeric("default_sell_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lids_contract_identity_unique_idx").on(
      table.type,
      table.brand,
      table.diameter,
      table.shape,
      table.color,
    ),
    check("lids_cost_price_non_negative", sql`${table.costPrice} >= 0`),
    check("lids_default_sell_price_non_negative", sql`${table.defaultSellPrice} >= 0`),
    check(
      "lids_type_brand_contract",
      sql`(
        (${table.type} = 'paper' AND ${table.brand} = 'other_supplier')
        OR
        (${table.type} = 'plastic')
      )`,
    ),
    check(
      "lids_type_diameter_contract",
      sql`(
        (${table.type} = 'paper' AND ${table.diameter} IN ('80mm', '90mm'))
        OR
        (${table.type} = 'plastic' AND ${table.diameter} IN ('95mm', '98mm'))
      )`,
    ),
    check(
      "lids_type_shape_contract",
      sql`(
        (${table.type} = 'paper' AND ${table.shape} = 'coffee_lid')
        OR
        (${table.type} = 'plastic' AND ${table.shape} IN ('dome', 'flat', 'strawless', 'tall_lid'))
      )`,
    ),
    check(
      "lids_type_color_contract",
      sql`(
        (${table.type} = 'paper' AND ${table.color} IN ('black', 'white'))
        OR
        (${table.type} = 'plastic' AND ${table.color} = 'transparent')
      )`,
    ),
  ],
)

export type Lid = typeof lids.$inferSelect
export type NewLid = typeof lids.$inferInsert
