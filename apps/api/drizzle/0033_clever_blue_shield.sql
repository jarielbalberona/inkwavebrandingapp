CREATE TABLE "product_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"cup_id" uuid,
	"lid_id" uuid,
	"cup_qty_per_set" integer DEFAULT 0 NOT NULL,
	"lid_qty_per_set" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_bundles_name_not_blank" CHECK (length(trim("product_bundles"."name")) > 0),
	CONSTRAINT "product_bundles_cup_qty_per_set_non_negative" CHECK ("product_bundles"."cup_qty_per_set" >= 0),
	CONSTRAINT "product_bundles_lid_qty_per_set_non_negative" CHECK ("product_bundles"."lid_qty_per_set" >= 0),
	CONSTRAINT "product_bundles_has_component" CHECK ("product_bundles"."cup_id" IS NOT NULL OR "product_bundles"."lid_id" IS NOT NULL),
	CONSTRAINT "product_bundles_cup_qty_matches_component" CHECK ((
        ("product_bundles"."cup_id" IS NULL AND "product_bundles"."cup_qty_per_set" = 0)
        OR
        ("product_bundles"."cup_id" IS NOT NULL AND "product_bundles"."cup_qty_per_set" > 0)
      )),
	CONSTRAINT "product_bundles_lid_qty_matches_component" CHECK ((
        ("product_bundles"."lid_id" IS NULL AND "product_bundles"."lid_qty_per_set" = 0)
        OR
        ("product_bundles"."lid_id" IS NOT NULL AND "product_bundles"."lid_qty_per_set" > 0)
      ))
);
--> statement-breakpoint
ALTER TABLE "product_bundles" ADD CONSTRAINT "product_bundles_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_bundles" ADD CONSTRAINT "product_bundles_lid_id_lids_id_fk" FOREIGN KEY ("lid_id") REFERENCES "public"."lids"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_bundles_name_unique_idx" ON "product_bundles" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "product_bundles_cup_id_idx" ON "product_bundles" USING btree ("cup_id");--> statement-breakpoint
CREATE INDEX "product_bundles_lid_id_idx" ON "product_bundles" USING btree ("lid_id");--> statement-breakpoint
CREATE INDEX "product_bundles_is_active_idx" ON "product_bundles" USING btree ("is_active");
