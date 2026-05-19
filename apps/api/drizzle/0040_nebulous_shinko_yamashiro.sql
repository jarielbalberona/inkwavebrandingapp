ALTER TYPE "public"."order_status" ADD VALUE 'ready_for_release' BEFORE 'partial_released';--> statement-breakpoint
UPDATE "orders" AS "order"
SET "status" = 'ready_for_release',
    "updated_at" = now()
WHERE "order"."status" IN ('pending', 'in_progress')
  AND EXISTS (
    SELECT 1
    FROM "order_items" AS "item"
    WHERE "item"."order_id" = "order"."id"
      AND "item"."item_type" IN ('cup', 'lid')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "order_items" AS "item"
    WHERE "item"."order_id" = "order"."id"
      AND "item"."item_type" = 'product_bundle'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "order_line_item_progress_events" AS "event"
    INNER JOIN "order_items" AS "item"
      ON "item"."id" = "event"."order_line_item_id"
    WHERE "item"."order_id" = "order"."id"
      AND "event"."stage" = 'released'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "order_items" AS "item"
    WHERE "item"."order_id" = "order"."id"
      AND "item"."item_type" IN ('cup', 'lid')
      AND "item"."quantity" > COALESCE((
        SELECT sum("event"."quantity")
        FROM "order_line_item_progress_events" AS "event"
        WHERE "event"."order_line_item_id" = "item"."id"
          AND "event"."stage" = 'ready_for_release'
      ), 0)
  );--> statement-breakpoint
ALTER TABLE "order_line_item_progress_events" ADD COLUMN "release_method" varchar(32);--> statement-breakpoint
ALTER TABLE "order_line_item_progress_events" ADD COLUMN "staging_location" text;--> statement-breakpoint
ALTER TABLE "order_line_item_progress_events" ADD COLUMN "released_to" text;--> statement-breakpoint
ALTER TABLE "order_line_item_progress_events" ADD COLUMN "scheduled_release_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_line_item_progress_events" ADD CONSTRAINT "order_line_item_progress_events_release_method_valid" CHECK ("order_line_item_progress_events"."release_method" IS NULL OR "order_line_item_progress_events"."release_method" IN ('delivery', 'office_pickup'));--> statement-breakpoint
ALTER TABLE "order_line_item_progress_events" ADD CONSTRAINT "order_line_item_progress_events_staging_location_not_blank" CHECK ("order_line_item_progress_events"."staging_location" IS NULL OR length(trim("order_line_item_progress_events"."staging_location")) > 0);--> statement-breakpoint
ALTER TABLE "order_line_item_progress_events" ADD CONSTRAINT "order_line_item_progress_events_released_to_not_blank" CHECK ("order_line_item_progress_events"."released_to" IS NULL OR length(trim("order_line_item_progress_events"."released_to")) > 0);
