ALTER TABLE "cups" DROP CONSTRAINT "cups_type_diameter_contract";--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_type_diameter_contract" CHECK (
  (
    "cups"."type" = 'paper'
    AND "cups"."diameter" IN ('80mm', '90mm')
  )
  OR
  (
    "cups"."type" = 'plastic'
    AND "cups"."brand" IN ('dabba', 'grecoopack')
    AND "cups"."diameter" = '95mm'
  )
  OR
  (
    "cups"."type" = 'plastic'
    AND "cups"."brand" IN ('china_supplier', 'other_supplier')
    AND "cups"."diameter" IN ('95mm', '98mm')
  )
);
