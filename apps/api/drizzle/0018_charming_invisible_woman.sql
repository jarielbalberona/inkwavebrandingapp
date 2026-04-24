CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'paid', 'void');--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "status" "invoice_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");