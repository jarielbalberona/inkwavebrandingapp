import { relations, sql } from "drizzle-orm"
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const notificationDigestTypeEnum = pgEnum("notification_digest_type", [
  "daily_business_digest",
])

export const notificationDigestRunStatusEnum = pgEnum("notification_digest_run_status", [
  "pending",
  "sending",
  "succeeded",
  "partial_failure",
  "failed",
  "skipped_no_recipients",
  "skipped_empty",
])

export const notificationDigestDeliveryStatusEnum = pgEnum("notification_digest_delivery_status", [
  "pending",
  "sent",
  "failed_retryable",
  "failed_terminal",
])

export const notificationDigestAttemptStatusEnum = pgEnum("notification_digest_attempt_status", [
  "sent",
  "failed_retryable",
  "failed_terminal",
])

export const notificationDigestRuns = pgTable(
  "notification_digest_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    digestType: notificationDigestTypeEnum("digest_type").notNull(),
    businessDate: date("business_date").notNull(),
    timezone: varchar("timezone", { length: 100 }).notNull(),
    status: notificationDigestRunStatusEnum("status").notNull().default("pending"),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    windowEndedAt: timestamp("window_ended_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastErrorCode: varchar("last_error_code", { length: 120 }),
    lastErrorMessage: text("last_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_digest_runs_type_business_date_unique_idx").on(
      table.digestType,
      table.businessDate,
    ),
    index("notification_digest_runs_status_idx").on(table.status),
    index("notification_digest_runs_business_date_idx").on(table.businessDate),
    index("notification_digest_runs_created_at_idx").on(table.createdAt),
    sql`CHECK (length(trim(${table.timezone})) > 0)`,
    sql`CHECK (${table.recipientCount} >= 0)`,
    sql`CHECK (${table.sentCount} >= 0)`,
    sql`CHECK (${table.failedCount} >= 0)`,
  ],
)

export const notificationDigestDeliveries = pgTable(
  "notification_digest_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => notificationDigestRuns.id, { onDelete: "cascade" }),
    recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
    recipientName: varchar("recipient_name", { length: 160 }),
    status: notificationDigestDeliveryStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    provider: varchar("provider", { length: 40 }),
    providerMessageId: varchar("provider_message_id", { length: 200 }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastErrorCode: varchar("last_error_code", { length: 120 }),
    lastErrorMessage: text("last_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_digest_deliveries_run_email_unique_idx").on(
      table.runId,
      sql`lower(${table.recipientEmail})`,
    ),
    index("notification_digest_deliveries_status_idx").on(table.status),
    index("notification_digest_deliveries_run_id_idx").on(table.runId),
    sql`CHECK (length(trim(${table.recipientEmail})) > 0)`,
    sql`CHECK (${table.attemptCount} >= 0)`,
  ],
)

export const notificationDigestDeliveryAttempts = pgTable(
  "notification_digest_delivery_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => notificationDigestDeliveries.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    status: notificationDigestAttemptStatusEnum("status").notNull(),
    provider: varchar("provider", { length: 40 }),
    providerMessageId: varchar("provider_message_id", { length: 200 }),
    errorCode: varchar("error_code", { length: 120 }),
    errorMessage: text("error_message"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_digest_delivery_attempts_delivery_attempt_unique_idx").on(
      table.deliveryId,
      table.attemptNumber,
    ),
    index("notification_digest_delivery_attempts_delivery_id_idx").on(table.deliveryId),
    index("notification_digest_delivery_attempts_attempted_at_idx").on(table.attemptedAt),
    sql`CHECK (${table.attemptNumber} > 0)`,
  ],
)

export const notificationDigestRunsRelations = relations(
  notificationDigestRuns,
  ({ many }) => ({
    deliveries: many(notificationDigestDeliveries),
  }),
)

export const notificationDigestDeliveriesRelations = relations(
  notificationDigestDeliveries,
  ({ many, one }) => ({
    run: one(notificationDigestRuns, {
      fields: [notificationDigestDeliveries.runId],
      references: [notificationDigestRuns.id],
    }),
    attempts: many(notificationDigestDeliveryAttempts),
  }),
)

export const notificationDigestDeliveryAttemptsRelations = relations(
  notificationDigestDeliveryAttempts,
  ({ one }) => ({
    delivery: one(notificationDigestDeliveries, {
      fields: [notificationDigestDeliveryAttempts.deliveryId],
      references: [notificationDigestDeliveries.id],
    }),
  }),
)

export type NotificationDigestRun = typeof notificationDigestRuns.$inferSelect
export type NewNotificationDigestRun = typeof notificationDigestRuns.$inferInsert
export type NotificationDigestDelivery = typeof notificationDigestDeliveries.$inferSelect
export type NewNotificationDigestDelivery = typeof notificationDigestDeliveries.$inferInsert
export type NotificationDigestDeliveryAttempt =
  typeof notificationDigestDeliveryAttempts.$inferSelect
export type NewNotificationDigestDeliveryAttempt =
  typeof notificationDigestDeliveryAttempts.$inferInsert
export type NotificationDigestType =
  (typeof notificationDigestTypeEnum.enumValues)[number]
export type NotificationDigestRunStatus =
  (typeof notificationDigestRunStatusEnum.enumValues)[number]
export type NotificationDigestDeliveryStatus =
  (typeof notificationDigestDeliveryStatusEnum.enumValues)[number]
export type NotificationDigestAttemptStatus =
  (typeof notificationDigestAttemptStatusEnum.enumValues)[number]
