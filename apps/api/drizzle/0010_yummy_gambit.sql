CREATE TYPE "public"."order_line_item_type" AS ENUM('cup', 'lid');--> statement-breakpoint
ALTER TABLE "order_items" RENAME COLUMN "cost_price" TO "unit_cost_price";--> statement-breakpoint
ALTER TABLE "order_items" RENAME COLUMN "sell_price" TO "unit_sell_price";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_cost_price_non_negative";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_sell_price_non_negative";--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "cup_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "item_type" "order_line_item_type";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "lid_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "description_snapshot" text;--> statement-breakpoint
UPDATE "order_items"
SET
  "item_type" = 'cup',
  "description_snapshot" = "cups"."sku"
FROM "cups"
WHERE "order_items"."cup_id" = "cups"."id";--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "item_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "description_snapshot" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_lid_id_lids_id_fk" FOREIGN KEY ("lid_id") REFERENCES "public"."lids"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_lid_id_idx" ON "order_items" USING btree ("lid_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_cost_price_non_negative" CHECK ("order_items"."unit_cost_price" >= 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_sell_price_non_negative" CHECK ("order_items"."unit_sell_price" >= 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_description_snapshot_not_blank" CHECK (length(trim("order_items"."description_snapshot")) > 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_exactly_one_item" CHECK ((
        ("order_items"."cup_id" IS NOT NULL AND "order_items"."lid_id" IS NULL)
        OR
        ("order_items"."cup_id" IS NULL AND "order_items"."lid_id" IS NOT NULL)
      ));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_type_matches_reference" CHECK ((
        ("order_items"."item_type" = 'cup' AND "order_items"."cup_id" IS NOT NULL AND "order_items"."lid_id" IS NULL)
        OR
        ("order_items"."item_type" = 'lid' AND "order_items"."lid_id" IS NOT NULL AND "order_items"."cup_id" IS NULL)
      ));
