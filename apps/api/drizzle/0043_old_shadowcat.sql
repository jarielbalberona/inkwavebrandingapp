CREATE TYPE "public"."paper_bowl_color" AS ENUM('white', 'kraft');--> statement-breakpoint
CREATE TYPE "public"."paper_bowl_size" AS ENUM('220cc', '320cc', '390cc', '520cc', '750cc');--> statement-breakpoint
CREATE TABLE "paper_bowls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(80) NOT NULL,
	"supplier" varchar(40) DEFAULT 'other_supplier' NOT NULL,
	"size" "paper_bowl_size" NOT NULL,
	"color" "paper_bowl_color" NOT NULL,
	"diameter_mm" integer,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"cost_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"default_sell_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paper_bowls_supplier_contract" CHECK ("paper_bowls"."supplier" = 'other_supplier'),
	CONSTRAINT "paper_bowls_diameter_positive" CHECK ("paper_bowls"."diameter_mm" IS NULL OR "paper_bowls"."diameter_mm" > 0),
	CONSTRAINT "paper_bowls_min_stock_non_negative" CHECK ("paper_bowls"."min_stock" >= 0),
	CONSTRAINT "paper_bowls_cost_price_non_negative" CHECK ("paper_bowls"."cost_price" >= 0),
	CONSTRAINT "paper_bowls_default_sell_price_non_negative" CHECK ("paper_bowls"."default_sell_price" >= 0),
	CONSTRAINT "paper_bowls_sku_not_blank" CHECK (length(trim("paper_bowls"."sku")) > 0),
	CONSTRAINT "paper_bowls_sku_normalized" CHECK ("paper_bowls"."sku" = upper("paper_bowls"."sku")),
	CONSTRAINT "paper_bowls_sku_allowed_characters" CHECK ("paper_bowls"."sku" ~ '^[A-Z0-9][A-Z0-9_-]{0,79}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "paper_bowls_sku_unique_idx" ON "paper_bowls" USING btree (lower("sku"));--> statement-breakpoint
CREATE UNIQUE INDEX "paper_bowls_identity_unique_idx" ON "paper_bowls" USING btree ("size","color");--> statement-breakpoint
INSERT INTO "paper_bowls" ("sku", "supplier", "size", "color", "diameter_mm", "min_stock", "cost_price", "default_sell_price", "is_active") VALUES
  ('220CC-PAPER-BOWL-OTHSPLR-WHT', 'other_supplier', '220cc', 'white', NULL, 0, '0.00', '5.00', true),
  ('220CC-PAPER-BOWL-OTHSPLR-KRFT', 'other_supplier', '220cc', 'kraft', NULL, 0, '0.00', '5.00', true),
  ('320CC-PAPER-BOWL-OTHSPLR-WHT', 'other_supplier', '320cc', 'white', NULL, 0, '0.00', '5.00', true),
  ('320CC-PAPER-BOWL-OTHSPLR-KRFT', 'other_supplier', '320cc', 'kraft', NULL, 0, '0.00', '5.00', true),
  ('390CC-PAPER-BOWL-OTHSPLR-WHT', 'other_supplier', '390cc', 'white', NULL, 0, '0.00', '5.00', true),
  ('390CC-PAPER-BOWL-OTHSPLR-KRFT', 'other_supplier', '390cc', 'kraft', NULL, 0, '0.00', '5.00', true),
  ('520CC-PAPER-BOWL-OTHSPLR-WHT', 'other_supplier', '520cc', 'white', NULL, 0, '0.00', '5.00', true),
  ('520CC-PAPER-BOWL-OTHSPLR-KRFT', 'other_supplier', '520cc', 'kraft', NULL, 0, '0.00', '5.00', true),
  ('750CC-PAPER-BOWL-OTHSPLR-WHT', 'other_supplier', '750cc', 'white', NULL, 0, '0.00', '5.00', true),
  ('750CC-PAPER-BOWL-OTHSPLR-KRFT', 'other_supplier', '750cc', 'kraft', NULL, 0, '0.00', '5.00', true)
ON CONFLICT DO NOTHING;
