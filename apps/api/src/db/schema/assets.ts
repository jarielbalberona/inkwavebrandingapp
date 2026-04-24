import { relations, sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const assetStorageProviderEnum = pgEnum("asset_storage_provider", ["r2"])
export const assetVisibilityEnum = pgEnum("asset_visibility", ["public", "private"])
export const assetKindEnum = pgEnum("asset_kind", ["invoice_pdf"])

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: assetKindEnum("kind").notNull(),
    storageProvider: assetStorageProviderEnum("storage_provider").notNull(),
    visibility: assetVisibilityEnum("visibility").notNull(),
    objectKey: varchar("object_key", { length: 512 }).notNull(),
    publicUrl: varchar("public_url", { length: 1024 }),
    filename: varchar("filename", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("assets_object_key_unique_idx").on(table.objectKey),
    index("assets_kind_idx").on(table.kind),
    check("assets_object_key_not_blank", sql`length(trim(${table.objectKey})) > 0`),
    check("assets_filename_not_blank", sql`length(trim(${table.filename})) > 0`),
    check("assets_content_type_not_blank", sql`length(trim(${table.contentType})) > 0`),
    check("assets_size_bytes_positive", sql`${table.sizeBytes} > 0`),
  ],
)

export const assetsRelations = relations(assets, () => ({}))

export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert
