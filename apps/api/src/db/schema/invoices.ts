import { relations, sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { customers } from "./customers.js"
import { orderItems, orderLineItemTypeEnum, orders } from "./orders.js"
import { users } from "./users.js"

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceNumber: varchar("invoice_number", { length: 80 }).notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    orderNumberSnapshot: varchar("order_number_snapshot", { length: 80 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    customerCodeSnapshot: varchar("customer_code_snapshot", { length: 80 }),
    customerBusinessNameSnapshot: varchar("customer_business_name_snapshot", { length: 160 }).notNull(),
    customerContactPersonSnapshot: varchar("customer_contact_person_snapshot", { length: 160 }),
    customerContactNumberSnapshot: varchar("customer_contact_number_snapshot", { length: 40 }),
    customerEmailSnapshot: varchar("customer_email_snapshot", { length: 320 }),
    customerAddressSnapshot: varchar("customer_address_snapshot", { length: 500 }),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invoices_invoice_number_unique_idx").on(sql`lower(${table.invoiceNumber})`),
    uniqueIndex("invoices_order_id_unique_idx").on(table.orderId),
    index("invoices_customer_id_idx").on(table.customerId),
    index("invoices_created_at_idx").on(table.createdAt),
    check("invoices_invoice_number_not_blank", sql`length(trim(${table.invoiceNumber})) > 0`),
    check(
      "invoices_order_number_snapshot_not_blank",
      sql`length(trim(${table.orderNumberSnapshot})) > 0`,
    ),
    check(
      "invoices_customer_business_name_not_blank",
      sql`length(trim(${table.customerBusinessNameSnapshot})) > 0`,
    ),
    check("invoices_subtotal_non_negative", sql`${table.subtotal} >= 0`),
  ],
)

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    itemType: orderLineItemTypeEnum("item_type").notNull(),
    descriptionSnapshot: text("description_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invoice_items_invoice_id_idx").on(table.invoiceId),
    index("invoice_items_order_item_id_idx").on(table.orderItemId),
    check("invoice_items_quantity_positive", sql`${table.quantity} > 0`),
    check("invoice_items_description_snapshot_not_blank", sql`length(trim(${table.descriptionSnapshot})) > 0`),
    check("invoice_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
    check("invoice_items_line_total_non_negative", sql`${table.lineTotal} >= 0`),
  ],
)

export const invoicesRelations = relations(invoices, ({ many, one }) => ({
  order: one(orders, {
    fields: [invoices.orderId],
    references: [orders.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    fields: [invoices.createdByUserId],
    references: [users.id],
  }),
  items: many(invoiceItems),
}))

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  orderItem: one(orderItems, {
    fields: [invoiceItems.orderItemId],
    references: [orderItems.id],
  }),
}))

export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type InvoiceItem = typeof invoiceItems.$inferSelect
export type NewInvoiceItem = typeof invoiceItems.$inferInsert
