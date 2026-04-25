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
import { lids } from "./lids.js"
import { nonStockItems } from "./non-stock-items.js"
import { productBundles } from "./product-bundles.js"
import { users } from "./users.js"

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "in_progress",
  "partial_released",
  "completed",
  "canceled",
])

export const orderLineItemProgressStageEnum = pgEnum("order_line_item_progress_stage", [
  "printed",
  "qa_passed",
  "packed",
  "ready_for_release",
  "released",
])

export const orderLineItemTypeEnum = pgEnum("order_line_item_type", [
  "cup",
  "lid",
  "non_stock_item",
  "custom_charge",
  "product_bundle",
])

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: varchar("order_number", { length: 80 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    priority: integer("priority").notNull().default(0),
    status: orderStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_order_number_unique_idx").on(sql`lower(${table.orderNumber})`),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_priority_idx").on(table.priority),
    index("orders_status_idx").on(table.status),
    index("orders_archived_at_idx").on(table.archivedAt),
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
    itemType: orderLineItemTypeEnum("item_type").notNull(),
    cupId: uuid("cup_id").references(() => cups.id, { onDelete: "restrict" }),
    lidId: uuid("lid_id").references(() => lids.id, { onDelete: "restrict" }),
    nonStockItemId: uuid("non_stock_item_id").references(() => nonStockItems.id, {
      onDelete: "restrict",
    }),
    productBundleId: uuid("product_bundle_id").references(() => productBundles.id, {
      onDelete: "restrict",
    }),
    descriptionSnapshot: text("description_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    unitCostPrice: numeric("unit_cost_price", { precision: 12, scale: 2 }).notNull().default("0"),
    unitSellPrice: numeric("unit_sell_price", { precision: 12, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_cup_id_idx").on(table.cupId),
    index("order_items_lid_id_idx").on(table.lidId),
    index("order_items_non_stock_item_id_idx").on(table.nonStockItemId),
    index("order_items_product_bundle_id_idx").on(table.productBundleId),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check("order_items_unit_cost_price_non_negative", sql`${table.unitCostPrice} >= 0`),
    check("order_items_unit_sell_price_non_negative", sql`${table.unitSellPrice} >= 0`),
    check("order_items_description_snapshot_not_blank", sql`length(trim(${table.descriptionSnapshot})) > 0`),
    check(
      "order_items_exactly_one_item",
      sql`(
        (${table.cupId} IS NOT NULL AND ${table.lidId} IS NULL AND ${table.nonStockItemId} IS NULL AND ${table.productBundleId} IS NULL)
        OR
        (${table.cupId} IS NULL AND ${table.lidId} IS NOT NULL AND ${table.nonStockItemId} IS NULL AND ${table.productBundleId} IS NULL)
        OR
        (${table.cupId} IS NULL AND ${table.lidId} IS NULL AND ${table.nonStockItemId} IS NOT NULL AND ${table.productBundleId} IS NULL)
        OR
        (${table.cupId} IS NULL AND ${table.lidId} IS NULL AND ${table.nonStockItemId} IS NULL AND ${table.productBundleId} IS NOT NULL)
        OR
        (${table.cupId} IS NULL AND ${table.lidId} IS NULL AND ${table.nonStockItemId} IS NULL AND ${table.productBundleId} IS NULL)
      )`,
    ),
    check(
      "order_items_item_type_matches_reference",
      sql`(
        (
          ${table.itemType} = 'cup'
          AND ${table.cupId} IS NOT NULL
          AND ${table.lidId} IS NULL
          AND ${table.nonStockItemId} IS NULL
          AND ${table.productBundleId} IS NULL
        )
        OR
        (
          ${table.itemType} = 'lid'
          AND ${table.lidId} IS NOT NULL
          AND ${table.cupId} IS NULL
          AND ${table.nonStockItemId} IS NULL
          AND ${table.productBundleId} IS NULL
        )
        OR
        (
          ${table.itemType} = 'non_stock_item'
          AND ${table.nonStockItemId} IS NOT NULL
          AND ${table.cupId} IS NULL
          AND ${table.lidId} IS NULL
          AND ${table.productBundleId} IS NULL
        )
        OR
        (
          ${table.itemType} = 'product_bundle'
          AND ${table.productBundleId} IS NOT NULL
          AND ${table.cupId} IS NULL
          AND ${table.lidId} IS NULL
          AND ${table.nonStockItemId} IS NULL
        )
        OR
        (
          ${table.itemType} = 'custom_charge'
          AND ${table.nonStockItemId} IS NULL
          AND ${table.cupId} IS NULL
          AND ${table.lidId} IS NULL
          AND ${table.productBundleId} IS NULL
        )
      )`,
    ),
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

export const orderLineItemProgressEvents = pgTable(
  "order_line_item_progress_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderLineItemId: uuid("order_line_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    stage: orderLineItemProgressStageEnum("stage").notNull(),
    quantity: integer("quantity").notNull(),
    note: text("note"),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_line_item_progress_events_line_item_id_idx").on(table.orderLineItemId),
    index("order_line_item_progress_events_stage_idx").on(table.stage),
    index("order_line_item_progress_events_event_date_idx").on(table.eventDate),
    check("order_line_item_progress_events_quantity_positive", sql`${table.quantity} > 0`),
  ],
)

export const orderItemsRelations = relations(orderItems, ({ many, one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  cup: one(cups, {
    fields: [orderItems.cupId],
    references: [cups.id],
  }),
  lid: one(lids, {
    fields: [orderItems.lidId],
    references: [lids.id],
  }),
  nonStockItem: one(nonStockItems, {
    fields: [orderItems.nonStockItemId],
    references: [nonStockItems.id],
  }),
  productBundle: one(productBundles, {
    fields: [orderItems.productBundleId],
    references: [productBundles.id],
  }),
  progressEvents: many(orderLineItemProgressEvents),
}))

export const orderLineItemProgressEventsRelations = relations(orderLineItemProgressEvents, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [orderLineItemProgressEvents.orderLineItemId],
    references: [orderItems.id],
  }),
  createdByUser: one(users, {
    fields: [orderLineItemProgressEvents.createdByUserId],
    references: [users.id],
  }),
}))

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
export type OrderLineItemProgressEvent = typeof orderLineItemProgressEvents.$inferSelect
export type NewOrderLineItemProgressEvent = typeof orderLineItemProgressEvents.$inferInsert
