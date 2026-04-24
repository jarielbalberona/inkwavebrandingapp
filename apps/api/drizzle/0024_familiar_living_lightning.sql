CREATE TYPE "public"."notification_digest_attempt_status" AS ENUM('sent', 'failed_retryable', 'failed_terminal');--> statement-breakpoint
CREATE TYPE "public"."notification_digest_delivery_status" AS ENUM('pending', 'sent', 'failed_retryable', 'failed_terminal');--> statement-breakpoint
CREATE TYPE "public"."notification_digest_run_status" AS ENUM('pending', 'sending', 'succeeded', 'partial_failure', 'failed', 'skipped_no_recipients', 'skipped_empty');--> statement-breakpoint
CREATE TYPE "public"."notification_digest_type" AS ENUM('daily_business_digest');--> statement-breakpoint
CREATE TABLE "notification_digest_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"recipient_name" varchar(160),
	"status" "notification_digest_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider" varchar(40),
	"provider_message_id" varchar(200),
	"delivered_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error_code" varchar(120),
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_digest_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" "notification_digest_attempt_status" NOT NULL,
	"provider" varchar(40),
	"provider_message_id" varchar(200),
	"error_code" varchar(120),
	"error_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_digest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_type" "notification_digest_type" NOT NULL,
	"business_date" date NOT NULL,
	"timezone" varchar(100) NOT NULL,
	"status" "notification_digest_run_status" DEFAULT 'pending' NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"window_ended_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error_code" varchar(120),
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_digest_deliveries" ADD CONSTRAINT "notification_digest_deliveries_run_id_notification_digest_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."notification_digest_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_digest_delivery_attempts" ADD CONSTRAINT "notification_digest_delivery_attempts_delivery_id_notification_digest_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."notification_digest_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_digest_deliveries_run_email_unique_idx" ON "notification_digest_deliveries" USING btree ("run_id",lower("recipient_email"));--> statement-breakpoint
CREATE INDEX "notification_digest_deliveries_status_idx" ON "notification_digest_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_digest_deliveries_run_id_idx" ON "notification_digest_deliveries" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_digest_delivery_attempts_delivery_attempt_unique_idx" ON "notification_digest_delivery_attempts" USING btree ("delivery_id","attempt_number");--> statement-breakpoint
CREATE INDEX "notification_digest_delivery_attempts_delivery_id_idx" ON "notification_digest_delivery_attempts" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "notification_digest_delivery_attempts_attempted_at_idx" ON "notification_digest_delivery_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_digest_runs_type_business_date_unique_idx" ON "notification_digest_runs" USING btree ("digest_type","business_date");--> statement-breakpoint
CREATE INDEX "notification_digest_runs_status_idx" ON "notification_digest_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_digest_runs_business_date_idx" ON "notification_digest_runs" USING btree ("business_date");--> statement-breakpoint
CREATE INDEX "notification_digest_runs_created_at_idx" ON "notification_digest_runs" USING btree ("created_at");