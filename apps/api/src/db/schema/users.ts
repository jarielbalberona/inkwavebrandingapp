import { sql } from "drizzle-orm"
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const userRoleEnum = pgEnum("user_role", ["admin", "staff"])

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 160 }),
    role: userRoleEnum("role").notNull(),
    permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique_idx").on(table.email)],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
