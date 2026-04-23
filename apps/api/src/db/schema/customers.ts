import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerCode: varchar("customer_code", { length: 80 }),
    businessName: varchar("business_name", { length: 160 }).notNull(),
    contactPerson: varchar("contact_person", { length: 160 }),
    contactNumber: varchar("contact_number", { length: 40 }),
    email: varchar("email", { length: 320 }),
    address: varchar("address", { length: 500 }),
    notes: varchar("notes", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customers_customer_code_unique_idx").on(sql`lower(${table.customerCode})`),
    index("customers_business_name_idx").on(sql`lower(${table.businessName})`),
    index("customers_email_idx").on(sql`lower(${table.email})`),
    check("customers_business_name_not_blank", sql`length(trim(${table.businessName})) > 0`),
    check(
      "customers_customer_code_not_blank",
      sql`${table.customerCode} is null or length(trim(${table.customerCode})) > 0`,
    ),
    check(
      "customers_contact_person_not_blank",
      sql`${table.contactPerson} is null or length(trim(${table.contactPerson})) > 0`,
    ),
    check(
      "customers_contact_number_not_blank",
      sql`${table.contactNumber} is null or length(trim(${table.contactNumber})) > 0`,
    ),
    check("customers_email_not_blank", sql`${table.email} is null or length(trim(${table.email})) > 0`),
    check("customers_address_not_blank", sql`${table.address} is null or length(trim(${table.address})) > 0`),
    check("customers_notes_not_blank", sql`${table.notes} is null or length(trim(${table.notes})) > 0`),
  ],
)

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
