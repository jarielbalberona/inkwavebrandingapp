UPDATE "paper_bowls"
SET
  "diameter_mm" = CASE "size"::text
    WHEN '220cc' THEN NULL
    WHEN '320cc' THEN 89
    WHEN '390cc' THEN 98
    WHEN '520cc' THEN 112
  END,
  "default_sell_price" = CASE "size"::text
    WHEN '220cc' THEN 3.92
    WHEN '320cc' THEN 4.16
    WHEN '390cc' THEN 4.20
    WHEN '520cc' THEN 4.72
  END,
  "updated_at" = now()
WHERE "size"::text IN ('220cc', '320cc', '390cc', '520cc');
