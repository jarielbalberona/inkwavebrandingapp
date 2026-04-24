-- Lid SKUs: first segment is full diameter (e.g. 80MM), matching generateLidSku in lib/master-data/sku.ts
UPDATE "lids"
SET "sku" = upper(
  regexp_replace(
    trim(
      "diameter"::text
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
