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
        WHEN 'china_supplier' THEN 'CHNSPLR'
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
);--> statement-breakpoint
UPDATE "lids"
SET "sku" = upper(
  regexp_replace(
    trim(
      regexp_replace("diameter"::text, 'mm$', '')
      || '-'
      || CASE "brand"
        WHEN 'dabba' THEN 'DBBA'
        WHEN 'grecoopack' THEN 'GRCPCK'
        WHEN 'china_supplier' THEN 'CHNSPLR'
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
);
