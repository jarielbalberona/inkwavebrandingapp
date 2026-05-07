ALTER TABLE "orders" ADD COLUMN "internal_notes" text;--> statement-breakpoint
UPDATE "orders" SET "notes" = NULL WHERE "notes" IS NOT NULL AND length(trim("notes")) = 0;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_notes_not_blank" CHECK ("orders"."notes" is null or length(trim("orders"."notes")) > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_internal_notes_not_blank" CHECK ("orders"."internal_notes" is null or length(trim("orders"."internal_notes")) > 0);
