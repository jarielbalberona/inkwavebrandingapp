CREATE TABLE "order_item_bundle_substitutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"source_product_bundle_id" uuid NOT NULL,
	"target_product_bundle_id" uuid NOT NULL,
	"source_description_snapshot" text NOT NULL,
	"target_description_snapshot" text NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_item_bundle_substitutions_different_bundles" CHECK ("order_item_bundle_substitutions"."source_product_bundle_id" <> "order_item_bundle_substitutions"."target_product_bundle_id"),
	CONSTRAINT "order_item_bundle_substitutions_source_description_not_blank" CHECK (length(trim("order_item_bundle_substitutions"."source_description_snapshot")) > 0),
	CONSTRAINT "order_item_bundle_substitutions_target_description_not_blank" CHECK (length(trim("order_item_bundle_substitutions"."target_description_snapshot")) > 0),
	CONSTRAINT "order_item_bundle_substitutions_reason_not_blank" CHECK (length(trim("order_item_bundle_substitutions"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "order_item_bundle_substitutions" ADD CONSTRAINT "order_item_bundle_substitutions_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_bundle_substitutions" ADD CONSTRAINT "order_item_bundle_substitutions_source_product_bundle_id_product_bundles_id_fk" FOREIGN KEY ("source_product_bundle_id") REFERENCES "public"."product_bundles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_bundle_substitutions" ADD CONSTRAINT "order_item_bundle_substitutions_target_product_bundle_id_product_bundles_id_fk" FOREIGN KEY ("target_product_bundle_id") REFERENCES "public"."product_bundles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_bundle_substitutions" ADD CONSTRAINT "order_item_bundle_substitutions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_item_bundle_substitutions_order_item_id_idx" ON "order_item_bundle_substitutions" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_item_bundle_substitutions_created_at_idx" ON "order_item_bundle_substitutions" USING btree ("created_at");