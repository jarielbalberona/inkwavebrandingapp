ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "orders_archived_at_idx" ON "orders" USING btree ("archived_at");
