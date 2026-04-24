-- NOTE: This file was never added to meta/_journal.json, so db:migrate:deploy skipped it.
-- The fix is 0029_users_permissions.sql (ADD COLUMN IF NOT EXISTS). Do not add this file to
-- the journal with an old timestamp — it will not run on DBs already past that revision.
ALTER TABLE "users" ADD COLUMN "permissions" text[] DEFAULT '{}'::text[] NOT NULL;
