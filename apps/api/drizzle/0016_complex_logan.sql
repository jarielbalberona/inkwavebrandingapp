CREATE TABLE "non_stock_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"cost_price" numeric(12, 2),
	"default_sell_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "non_stock_items_name_not_blank" CHECK (length(trim("non_stock_items"."name")) > 0),
	CONSTRAINT "non_stock_items_cost_price_non_negative" CHECK ("non_stock_items"."cost_price" IS NULL OR "non_stock_items"."cost_price" >= 0),
	CONSTRAINT "non_stock_items_default_sell_price_non_negative" CHECK ("non_stock_items"."default_sell_price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "non_stock_items_name_unique_idx" ON "non_stock_items" USING btree (lower("name"));