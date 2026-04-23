import { relations, sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { cups } from "./cups.js"
import { customers } from "./customers.js"
import { users } from "./users.js"

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "in_progress",
  "partial_released",
  "completed",
  "canceled",
])

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: varchar("order_number", { length: 80 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_order_number_unique_idx").on(sql`lower(${table.orderNumber})`),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_status_idx").on(table.status),
    index("orders_created_at_idx").on(table.createdAt),
    check("orders_order_number_not_blank", sql`length(trim(${table.orderNumber})) > 0`),
  ],
)

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    cupId: uuid("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull().default("0"),
    sellPrice: numeric("sell_price", { precision: 12, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_cup_id_idx").on(table.cupId),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check("order_items_cost_price_non_negative", sql`${table.costPrice} >= 0`),
    check("order_items_sell_price_non_negative", sql`${table.sellPrice} >= 0`),
  ],
)

export const ordersRelations = relations(orders, ({ many, one }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    fields: [orders.createdByUserId],
    references: [users.id],
  }),
  items: many(orderItems),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  cup: one(cups, {
    fields: [orderItems.cupId],
    references: [cups.id],
  }),
}))

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
