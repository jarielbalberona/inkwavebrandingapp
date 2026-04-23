DROP INDEX "cups_sku_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "cups_sku_unique_idx" ON "cups" USING btree (lower("sku"));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_sku_normalized" CHECK ("cups"."sku" = upper("cups"."sku"));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_sku_allowed_characters" CHECK ("cups"."sku" ~ '^[A-Z0-9][A-Z0-9_-]{0,79}$');