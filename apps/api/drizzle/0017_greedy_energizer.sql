ALTER TYPE "public"."order_line_item_type" ADD VALUE IF NOT EXISTS 'non_stock_item';--> statement-breakpoint
ALTER TYPE "public"."order_line_item_type" ADD VALUE IF NOT EXISTS 'custom_charge';--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_exactly_one_item";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_item_type_matches_reference";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "non_stock_item_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_non_stock_item_id_non_stock_items_id_fk" FOREIGN KEY ("non_stock_item_id") REFERENCES "public"."non_stock_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_non_stock_item_id_idx" ON "order_items" USING btree ("non_stock_item_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_exactly_one_item" CHECK ((
        ("order_items"."cup_id" IS NOT NULL AND "order_items"."lid_id" IS NULL AND "order_items"."non_stock_item_id" IS NULL)
        OR
        ("order_items"."cup_id" IS NULL AND "order_items"."lid_id" IS NOT NULL AND "order_items"."non_stock_item_id" IS NULL)
        OR
        ("order_items"."cup_id" IS NULL AND "order_items"."lid_id" IS NULL AND "order_items"."non_stock_item_id" IS NOT NULL)
        OR
        ("order_items"."cup_id" IS NULL AND "order_items"."lid_id" IS NULL AND "order_items"."non_stock_item_id" IS NULL)
      ));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_type_matches_reference" CHECK ((
        (
          "order_items"."item_type" = 'cup'
          AND "order_items"."cup_id" IS NOT NULL
          AND "order_items"."lid_id" IS NULL
          AND "order_items"."non_stock_item_id" IS NULL
        )
        OR
        (
          "order_items"."item_type" = 'lid'
          AND "order_items"."lid_id" IS NOT NULL
          AND "order_items"."cup_id" IS NULL
          AND "order_items"."non_stock_item_id" IS NULL
        )
        OR
        (
          "order_items"."item_type" = 'non_stock_item'
          AND "order_items"."non_stock_item_id" IS NOT NULL
          AND "order_items"."cup_id" IS NULL
          AND "order_items"."lid_id" IS NULL
        )
        OR
        (
          "order_items"."item_type" = 'custom_charge'
          AND "order_items"."non_stock_item_id" IS NULL
          AND "order_items"."cup_id" IS NULL
          AND "order_items"."lid_id" IS NULL
        )
      ));
