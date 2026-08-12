UPDATE "paper_bowls"
SET
  "diameter_mm" = 85,
  "updated_at" = now()
WHERE "size"::text = '220cc';
