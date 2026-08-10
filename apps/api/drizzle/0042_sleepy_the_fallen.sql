ALTER TYPE "public"."cup_color" ADD VALUE IF NOT EXISTS 'blue';--> statement-breakpoint
ALTER TYPE "public"."cup_color" ADD VALUE IF NOT EXISTS 'grey';--> statement-breakpoint
ALTER TYPE "public"."cup_color" ADD VALUE IF NOT EXISTS 'green';--> statement-breakpoint
ALTER TYPE "public"."cup_color" ADD VALUE IF NOT EXISTS 'red';--> statement-breakpoint
ALTER TYPE "public"."cup_color" ADD VALUE IF NOT EXISTS 'teal';--> statement-breakpoint
ALTER TABLE "cups" DROP CONSTRAINT "cups_type_color_contract";--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_type_color_contract" CHECK ((
        ("cups"."type" = 'paper' AND "cups"."color" IN ('white', 'black', 'kraft', 'blue', 'grey', 'green', 'red', 'teal'))
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
      ));
