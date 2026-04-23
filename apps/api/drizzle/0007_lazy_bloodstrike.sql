CREATE TYPE "public"."cup_brand" AS ENUM('dabba', 'grecoopack', 'china_supplier', 'other_supplier');--> statement-breakpoint
CREATE TYPE "public"."cup_color" AS ENUM('transparent', 'black', 'white', 'kraft');--> statement-breakpoint
CREATE TYPE "public"."cup_diameter" AS ENUM('80mm', '90mm', '95mm', '98mm');--> statement-breakpoint
CREATE TYPE "public"."cup_size" AS ENUM('6.5oz', '8oz', '12oz', '16oz', '20oz', '22oz');--> statement-breakpoint
CREATE TYPE "public"."cup_type" AS ENUM('paper', 'plastic');--> statement-breakpoint
ALTER TABLE "cups" RENAME COLUMN "material" TO "type";--> statement-breakpoint
ALTER TABLE "cups" RENAME COLUMN "dimension" TO "diameter";--> statement-breakpoint
ALTER TABLE "cups" DROP CONSTRAINT "cups_brand_not_blank";--> statement-breakpoint
ALTER TABLE "cups" DROP CONSTRAINT "cups_size_not_blank";--> statement-breakpoint
ALTER TABLE "cups" DROP CONSTRAINT "cups_dimension_not_blank";--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "type" SET DATA TYPE "public"."cup_type" USING "type"::"public"."cup_type";--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "diameter" SET DATA TYPE "public"."cup_diameter" USING replace("diameter", '95m', '95mm')::"public"."cup_diameter";--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "brand" SET DATA TYPE "public"."cup_brand" USING "brand"::"public"."cup_brand";--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "size" SET DATA TYPE "public"."cup_size" USING "size"::"public"."cup_size";--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "color" SET DATA TYPE "public"."cup_color" USING "color"::"public"."cup_color";--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "color" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_type_brand_contract" CHECK ((
        ("cups"."type" = 'paper' AND "cups"."brand" = 'other_supplier')
        OR
        ("cups"."type" = 'plastic')
      ));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_type_diameter_contract" CHECK ((
        ("cups"."type" = 'paper' AND "cups"."diameter" IN ('80mm', '90mm'))
        OR
        ("cups"."type" = 'plastic' AND "cups"."diameter" IN ('95mm', '98mm'))
      ));--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_type_size_contract" CHECK ((
        ("cups"."type" = 'paper' AND "cups"."size" IN ('6.5oz', '8oz', '12oz', '16oz'))
        OR
        ("cups"."type" = 'plastic' AND "cups"."size" IN ('12oz', '16oz', '20oz', '22oz'))
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
          AND "cups"."brand" IN ('china_supplier', 'other_supplier')
          AND "cups"."color" IN ('transparent', 'black')
        )
      ));
