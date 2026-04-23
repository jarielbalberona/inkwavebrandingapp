CREATE TYPE "public"."order_line_item_progress_stage" AS ENUM('printed', 'qa_passed', 'packed', 'ready_for_release', 'released');--> statement-breakpoint
CREATE TABLE "order_line_item_progress_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_line_item_id" uuid NOT NULL,
	"stage" "order_line_item_progress_stage" NOT NULL,
	"quantity" integer NOT NULL,
	"note" text,
	"event_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_line_item_progress_events_quantity_positive" CHECK ("order_line_item_progress_events"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_line_item_progress_events" ADD CONSTRAINT "order_line_item_progress_events_order_line_item_id_order_items_id_fk" FOREIGN KEY ("order_line_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_item_progress_events" ADD CONSTRAINT "order_line_item_progress_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_line_item_progress_events_line_item_id_idx" ON "order_line_item_progress_events" USING btree ("order_line_item_id");--> statement-breakpoint
CREATE INDEX "order_line_item_progress_events_stage_idx" ON "order_line_item_progress_events" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "order_line_item_progress_events_event_date_idx" ON "order_line_item_progress_events" USING btree ("event_date");