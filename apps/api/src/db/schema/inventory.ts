import { relations, sql } from "drizzle-orm"
import {
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { cups } from "./cups.js"
import { users } from "./users.js"

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "stock_in",
  "reserve",
  "release_reservation",
  "consume",
  "adjustment_in",
  "adjustment_out",
])

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cupId: uuid("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "restrict" }),
    movementType: inventoryMovementTypeEnum("movement_type").notNull(),
    quantity: integer("quantity").notNull(),
    orderId: uuid("order_id"),
    orderItemId: uuid("order_item_id"),
    note: text("note"),
    reference: text("reference"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("inventory_movements_quantity_positive", sql`${table.quantity} > 0`)],
)

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  cup: one(cups, {
    fields: [inventoryMovements.cupId],
    references: [cups.id],
  }),
  createdByUser: one(users, {
    fields: [inventoryMovements.createdByUserId],
    references: [users.id],
  }),
}))

export type InventoryMovement = typeof inventoryMovements.$inferSelect
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert
