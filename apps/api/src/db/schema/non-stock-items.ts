import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const nonStockItems = pgTable(
  "non_stock_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
    defaultSellPrice: numeric("default_sell_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("non_stock_items_name_unique_idx").on(sql`lower(${table.name})`),
    check("non_stock_items_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check(
      "non_stock_items_cost_price_non_negative",
      sql`${table.costPrice} IS NULL OR ${table.costPrice} >= 0`,
    ),
    check(
      "non_stock_items_default_sell_price_non_negative",
      sql`${table.defaultSellPrice} >= 0`,
    ),
  ],
)

export type NonStockItem = typeof nonStockItems.$inferSelect
export type NewNonStockItem = typeof nonStockItems.$inferInsert
