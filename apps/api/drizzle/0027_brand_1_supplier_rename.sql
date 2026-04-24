ALTER TABLE "cups" DROP CONSTRAINT "cups_type_diameter_contract";--> statement-breakpoint
ALTER TABLE "cups" DROP CONSTRAINT "cups_type_color_contract";--> statement-breakpoint
ALTER TABLE "lids" DROP CONSTRAINT "lids_type_color_contract";--> statement-breakpoint
ALTER TYPE "public"."cup_brand" RENAME VALUE 'china_supplier' TO 'brand_1';--> statement-breakpoint
ALTER TYPE "public"."lid_brand" RENAME VALUE 'china_supplier' TO 'brand_1';--> statement-breakpoint
UPDATE "cups"
SET "sku" = upper(
  regexp_replace(
    trim(
      "size"::text
      || '-'
      || "type"::text
      || '-'
      || CASE "brand"
        WHEN 'dabba' THEN 'DBBA'
        WHEN 'grecoopack' THEN 'GRCPCK'
        WHEN 'brand_1' THEN 'BRND1'
        WHEN 'other_supplier' THEN 'OTHSPLR'
      END
      || '-'
      || CASE "color"
        WHEN 'transparent' THEN 'TRNSPRNT'
        WHEN 'black' THEN 'BLCK'
        WHEN 'white' THEN 'WHT'
        WHEN 'kraft' THEN 'KRFT'
      END
    ),
    '\s+',
    '-',
    'g'
  )
)
WHERE "brand" = 'brand_1';--> statement-breakpoint
UPDATE "lids"
SET "sku" = upper(
  regexp_replace(
    trim(
      "diameter"::text
      || '-'
      || CASE "brand"
        WHEN 'dabba' THEN 'DBBA'
        WHEN 'grecoopack' THEN 'GRCPCK'
        WHEN 'brand_1' THEN 'BRND1'
        WHEN 'other_supplier' THEN 'OTHSPLR'
      END
      || '-'
      || "shape"::text
      || CASE
        WHEN "color" = 'transparent' THEN ''
        ELSE '-' || CASE "color"
          WHEN 'black' THEN 'BLCK'
          WHEN 'white' THEN 'WHT'
        END
      END
    ),
    '\s+',
    '-',
    'g'
  )
)
WHERE "brand" = 'brand_1';--> statement-breakpoint
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
    AND "cups"."brand" IN ('brand_1', 'other_supplier')
    AND "cups"."diameter" IN ('95mm', '98mm')
  )
);--> statement-breakpoint
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
