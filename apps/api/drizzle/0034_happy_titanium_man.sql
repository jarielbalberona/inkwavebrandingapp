CREATE TABLE "sellable_product_price_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_bundle_id" uuid NOT NULL,
	"min_qty" integer NOT NULL,
	"max_qty" integer,
	"unit_price" numeric(12, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellable_price_rules_min_qty_positive" CHECK ("sellable_product_price_rules"."min_qty" > 0),
	CONSTRAINT "sellable_price_rules_max_qty_valid" CHECK ("sellable_product_price_rules"."max_qty" IS NULL OR "sellable_product_price_rules"."max_qty" >= "sellable_product_price_rules"."min_qty"),
	CONSTRAINT "sellable_price_rules_unit_price_non_negative" CHECK ("sellable_product_price_rules"."unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sellable_product_price_rules" ADD CONSTRAINT "sellable_product_price_rules_product_bundle_id_product_bundles_id_fk" FOREIGN KEY ("product_bundle_id") REFERENCES "public"."product_bundles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sellable_price_rules_bundle_id_idx" ON "sellable_product_price_rules" USING btree ("product_bundle_id");--> statement-breakpoint
CREATE INDEX "sellable_price_rules_active_idx" ON "sellable_product_price_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sellable_price_rules_bundle_active_min_idx" ON "sellable_product_price_rules" USING btree ("product_bundle_id","is_active","min_qty");