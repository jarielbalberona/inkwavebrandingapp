-- The permissions column + migration 0021_user_permissions were added in code but
-- 0021 was never listed in meta/_journal.sql, so db:migrate:deploy skipped it. This
-- migration is safe on fresh DBs (IF NOT EXISTS) and on prod that is missing the column.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" text[] DEFAULT '{}'::text[] NOT NULL;
