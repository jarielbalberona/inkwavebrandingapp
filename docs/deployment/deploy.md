# Deployment Notes

This repo now has source-controlled Render service definitions. That is not the same as proven deployment readiness.

Use this runbook to deploy without guessing.

## Environment Model

The repo supports two deployment environments in principle:

- staging
- production

Current honest state:

- the service contract is the same for both
- the repo does not prove a separate staging stack already exists
- if staging does not exist yet, create it before treating production as the first real smoke target

Do not call a direct production push “staging by confidence.” That is lazy and it is how people create outages.

## Deployment Order

1. Confirm Render environment values are present for the target web and API services.
2. Confirm the database target points to the Ink Wave database only.
   - on Render, prefer the split `DATABASE_HOST` / `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_NAME` path from `render.yaml`
   - use `DATABASE_URL` locally when that is simpler and safe
3. Confirm the API build still passes locally:
   - `pnpm --filter @workspace/api build`
4. Confirm the web build still passes locally:
   - `pnpm --filter web build`
5. Confirm the API would talk to the expected database before mutating anything:
   - `pnpm --filter @workspace/api db:check`
6. Deploy the API service.
7. Render runs the API `preDeployCommand` before switching traffic:
   - `pnpm --filter @workspace/api db:migrate:deploy`
   - this fails early if the database already contains app tables but Drizzle has no `__drizzle_migrations` history
8. Wait for the API health check at `/health` to return `200`.
9. Deploy the web service.
10. If this is a brand-new database, seed the bootstrap admin after the first successful API deploy:
   - `pnpm --filter @workspace/api seed:admin`
    - after bootstrap, manage ongoing staff/admin changes from the app’s `/users` surface rather than repeated seed runs
11. Run the smoke checks below.

If step 2 is skipped, the rest of this runbook is worthless.

## Smoke Checks

Minimum smoke after deploy:

### Platform

- web loads without a blank screen
- API `/health` returns `200`
- browser requests point to the intended API origin

### Auth

- admin can log in
- logout clears the session
- unauthenticated access to protected routes returns `401`

### Master Data

- cups list loads
- lids list loads
- create/edit forms still submit for admin

### Inventory

- balances page loads
- movement history loads
- stock intake works for an active tracked item
- manual adjustment works for an active tracked item

### Orders

- orders list loads
- order detail loads
- create order still validates inventory/customer inputs

### Authorization

- staff can view allowed inventory/order surfaces
- staff does not receive confidential pricing/customer payloads where the backend is supposed to filter them

Do not mark the deploy healthy just because `/health` is green. That only proves the process is standing up.

## Rollback Reality

- Render can redeploy a previous service version.
- Database migrations are the hard part. There is no automatic safe rollback for a bad destructive migration.
- If a migration is wrong, recovery depends on backups and restore procedure, not optimism.

That means:

- keep migrations deliberate
- deploy small increments
- verify database target before every migration run

## Known Manual Work

- Render environment values are still dashboard-managed
- API database migrations are now expected to run through the Render `preDeployCommand`
- bootstrap admin seeding is still a deliberate post-deploy operator step
- no CI/CD pipeline is handling promotion automatically
- no live post-deploy smoke automation exists in this repo yet

This is acceptable for an internal MVP. It is not mature operations.
