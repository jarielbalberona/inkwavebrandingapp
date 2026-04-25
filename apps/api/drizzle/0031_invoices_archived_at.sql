ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "invoices_archived_at_idx" ON "invoices" USING btree ("archived_at");
