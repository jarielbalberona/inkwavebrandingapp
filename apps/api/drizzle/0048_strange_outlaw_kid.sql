ALTER TABLE "customers" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "customers_archived_at_idx" ON "customers" USING btree ("archived_at");