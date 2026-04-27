ALTER TABLE "order_line_item_progress_events" ADD COLUMN "component_item_type" varchar(10);--> statement-breakpoint
UPDATE "order_line_item_progress_events" AS "progress"
SET "component_item_type" = CASE
  WHEN "progress"."stage" IN ('printed', 'qa_passed') THEN 'cup'
  ELSE 'lid'
END
FROM "order_items"
WHERE "progress"."order_line_item_id" = "order_items"."id"
  AND "order_items"."item_type" = 'product_bundle';--> statement-breakpoint
CREATE INDEX "order_line_item_progress_events_component_item_type_idx" ON "order_line_item_progress_events" USING btree ("component_item_type");--> statement-breakpoint
ALTER TABLE "order_line_item_progress_events" ADD CONSTRAINT "order_line_item_progress_events_component_item_type_valid" CHECK ("order_line_item_progress_events"."component_item_type" IS NULL OR "order_line_item_progress_events"."component_item_type" IN ('cup', 'lid'));
