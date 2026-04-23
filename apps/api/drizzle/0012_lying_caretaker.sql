ALTER TABLE "lids" ADD COLUMN "sku" varchar(80);--> statement-breakpoint
UPDATE "lids"
SET "sku" = regexp_replace("diameter", 'mm$', '')
  || '-'
  || CASE "brand"
    WHEN 'dabba' THEN 'DBBA'
    WHEN 'grecoopack' THEN 'GRCPCK'
    WHEN 'china_supplier' THEN 'CHNSPLR'
    WHEN 'other_supplier' THEN 'OTHSPLR'
  END
  || '-'
  || CASE "shape"
    WHEN 'dome' THEN 'DM'
    WHEN 'flat' THEN 'FLT'
    WHEN 'strawless' THEN 'STRWLS'
    WHEN 'coffee_lid' THEN 'CFFLD'
    WHEN 'tall_lid' THEN 'TLLD'
  END
  || CASE
    WHEN "color" = 'transparent' THEN ''
    ELSE '-' || CASE "color"
      WHEN 'black' THEN 'BLCK'
      WHEN 'white' THEN 'WHT'
    END
  END;--> statement-breakpoint
ALTER TABLE "lids" ALTER COLUMN "sku" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lids_sku_unique_idx" ON "lids" USING btree (lower("sku"));--> statement-breakpoint
ALTER TABLE "lids" ADD CONSTRAINT "lids_sku_not_blank" CHECK (length(trim("lids"."sku")) > 0);--> statement-breakpoint
ALTER TABLE "lids" ADD CONSTRAINT "lids_sku_normalized" CHECK ("lids"."sku" = upper("lids"."sku"));--> statement-breakpoint
ALTER TABLE "lids" ADD CONSTRAINT "lids_sku_allowed_characters" CHECK ("lids"."sku" ~ '^[A-Z0-9][A-Z0-9_-]{0,79}$');
