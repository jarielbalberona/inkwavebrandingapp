ALTER TABLE "cups" DROP CONSTRAINT "cups_type_diameter_contract";--> statement-breakpoint
ALTER TABLE "cups" DROP CONSTRAINT "cups_type_color_contract";--> statement-breakpoint
ALTER TABLE "lids" DROP CONSTRAINT "lids_type_color_contract";--> statement-breakpoint
ALTER TABLE "cups" DROP CONSTRAINT "cups_type_brand_contract";--> statement-breakpoint
ALTER TABLE "lids" DROP CONSTRAINT "lids_type_brand_contract";--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "brand" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."cup_brand";--> statement-breakpoint
CREATE TYPE "public"."cup_brand" AS ENUM('dabba', 'grecoopack', 'brand_1', 'other_supplier');--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "brand" SET DATA TYPE "public"."cup_brand" USING (
        CASE
          WHEN "brand" = 'china_supplier' THEN 'brand_1'::"public"."cup_brand"
          ELSE "brand"::"public"."cup_brand"
        END
      );--> statement-breakpoint
ALTER TABLE "lids" ALTER COLUMN "brand" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."lid_brand";--> statement-breakpoint
CREATE TYPE "public"."lid_brand" AS ENUM('dabba', 'grecoopack', 'brand_1', 'other_supplier');--> statement-breakpoint
ALTER TABLE "lids" ALTER COLUMN "brand" SET DATA TYPE "public"."lid_brand" USING (
        CASE
          WHEN "brand" = 'china_supplier' THEN 'brand_1'::"public"."lid_brand"
          ELSE "brand"::"public"."lid_brand"
        END
      );--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_type_brand_contract" CHECK ((
        ("cups"."type" = 'paper' AND "cups"."brand" = 'other_supplier')
        OR
        ("cups"."type" = 'plastic')
      ));--> statement-breakpoint
ALTER TABLE "lids" ADD CONSTRAINT "lids_type_brand_contract" CHECK ((
        ("lids"."type" = 'paper' AND "lids"."brand" = 'other_supplier')
        OR
        ("lids"."type" = 'plastic')
      ));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_type_diameter_contract" CHECK ((
        ("cups"."type" = 'paper' AND "cups"."diameter" IN ('80mm', '90mm'))
        OR
        (
          "cups"."type" = 'plastic'
          AND "cups"."brand" IN ('dabba', 'grecoopack')
          AND "cups"."diameter" = '95mm'
        )
        OR
        (
          "cups"."type" = 'plastic'
          AND "cups"."brand" IN ('brand_1', 'other_supplier')
          AND "cups"."diameter" IN ('95mm', '98mm')
        )
      ));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_type_color_contract" CHECK ((
        ("cups"."type" = 'paper' AND "cups"."color" IN ('white', 'black', 'kraft'))
        OR
        (
          "cups"."type" = 'plastic'
          AND "cups"."brand" IN ('dabba', 'grecoopack')
          AND "cups"."color" = 'transparent'
        )
        OR
        (
          "cups"."type" = 'plastic'
          AND "cups"."brand" IN ('brand_1', 'other_supplier')
          AND "cups"."color" IN ('transparent', 'black')
        )
      ));--> statement-breakpoint
ALTER TABLE "lids" ADD CONSTRAINT "lids_type_color_contract" CHECK ((
        ("lids"."type" = 'paper' AND "lids"."color" IN ('black', 'white'))
        OR
        (
          "lids"."type" = 'plastic'
          AND "lids"."brand" IN ('dabba', 'grecoopack')
          AND "lids"."color" = 'transparent'
        )
        OR
        (
          "lids"."type" = 'plastic'
          AND "lids"."brand" IN ('brand_1', 'other_supplier')
          AND "lids"."color" IN ('transparent', 'black')
        )
      ));