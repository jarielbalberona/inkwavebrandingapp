CREATE TABLE "cups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(80) NOT NULL,
	"brand" varchar(160) NOT NULL,
	"size" varchar(80) NOT NULL,
	"dimension" varchar(120) NOT NULL,
	"material" varchar(80),
	"color" varchar(80),
	"min_stock" integer DEFAULT 0 NOT NULL,
	"cost_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"default_sell_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cups_min_stock_non_negative" CHECK ("cups"."min_stock" >= 0),
	CONSTRAINT "cups_cost_price_non_negative" CHECK ("cups"."cost_price" >= 0),
	CONSTRAINT "cups_default_sell_price_non_negative" CHECK ("cups"."default_sell_price" >= 0),
	CONSTRAINT "cups_sku_not_blank" CHECK (length(trim("cups"."sku")) > 0),
	CONSTRAINT "cups_brand_not_blank" CHECK (length(trim("cups"."brand")) > 0),
	CONSTRAINT "cups_size_not_blank" CHECK (length(trim("cups"."size")) > 0),
	CONSTRAINT "cups_dimension_not_blank" CHECK (length(trim("cups"."dimension")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cups_sku_unique_idx" ON "cups" USING btree ("sku");