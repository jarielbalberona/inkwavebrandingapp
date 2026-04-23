CREATE TYPE "public"."lid_brand" AS ENUM('dabba', 'grecoopack', 'china_supplier', 'other_supplier');--> statement-breakpoint
CREATE TYPE "public"."lid_color" AS ENUM('transparent', 'black', 'white');--> statement-breakpoint
CREATE TYPE "public"."lid_diameter" AS ENUM('80mm', '90mm', '95mm', '98mm');--> statement-breakpoint
CREATE TYPE "public"."lid_shape" AS ENUM('dome', 'flat', 'strawless', 'coffee_lid', 'tall_lid');--> statement-breakpoint
CREATE TYPE "public"."lid_type" AS ENUM('paper', 'plastic');--> statement-breakpoint
CREATE TABLE "lids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "lid_type" NOT NULL,
	"brand" "lid_brand" NOT NULL,
	"diameter" "lid_diameter" NOT NULL,
	"shape" "lid_shape" NOT NULL,
	"color" "lid_color" NOT NULL,
	"cost_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"default_sell_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lids_cost_price_non_negative" CHECK ("lids"."cost_price" >= 0),
	CONSTRAINT "lids_default_sell_price_non_negative" CHECK ("lids"."default_sell_price" >= 0),
	CONSTRAINT "lids_type_brand_contract" CHECK ((
        ("lids"."type" = 'paper' AND "lids"."brand" = 'other_supplier')
        OR
        ("lids"."type" = 'plastic')
      )),
	CONSTRAINT "lids_type_diameter_contract" CHECK ((
        ("lids"."type" = 'paper' AND "lids"."diameter" IN ('80mm', '90mm'))
        OR
        ("lids"."type" = 'plastic' AND "lids"."diameter" IN ('95mm', '98mm'))
      )),
	CONSTRAINT "lids_type_shape_contract" CHECK ((
        ("lids"."type" = 'paper' AND "lids"."shape" = 'coffee_lid')
        OR
        ("lids"."type" = 'plastic' AND "lids"."shape" IN ('dome', 'flat', 'strawless', 'tall_lid'))
      )),
	CONSTRAINT "lids_type_color_contract" CHECK ((
        ("lids"."type" = 'paper' AND "lids"."color" IN ('black', 'white'))
        OR
        ("lids"."type" = 'plastic' AND "lids"."color" = 'transparent')
      ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "lids_contract_identity_unique_idx" ON "lids" USING btree ("type","brand","diameter","shape","color");