# Database Provisioning And Isolation

This app is allowed to share a Render PostgreSQL instance. It is not allowed to share a database.

If that distinction gets blurred, somebody will eventually run Ink Wave migrations against another app and damage production. That is not a theoretical risk. It is the default failure mode when people treat a shared instance like a shared sandbox.

## Required Production Shape

- one shared Render PostgreSQL instance
- one dedicated database for this app, for example `ink_wave_branding_app`
- one dedicated database user/credential for this app if Render allows it
- one `DATABASE_URL` that points only to the Ink Wave database
- no shared schemas, no cross-app tables, no “temporary” reuse of another app database

If Render cannot provide a dedicated database user on the current plan, document that limitation in the service handoff and restrict credential access tightly. That is a concession, not a good design.

## Repo Truth

Current repo wiring already assumes one app-specific database target:

- `apps/api/.env.example` points local development at `ink_wave_branding_app`
- `apps/api/src/config/env.ts` requires `DATABASE_URL` for database work
- `apps/api/drizzle.config.ts` loads the API `.env` and sends Drizzle only to that `DATABASE_URL`
- Drizzle migrations live in `apps/api/drizzle`
- Drizzle schema source is `apps/api/src/db/schema/index.ts`

Nothing in this repo supports multi-app schema sharing. Keep it that way.

## Environment Variables

These values are required for safe database targeting:

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API runtime + Drizzle | Full connection string for the Ink Wave database only |
| `DATABASE_SSL_MODE` | API runtime + Drizzle | `require` on Render, `disable` only for local non-SSL setups |

Do not put database credentials in the frontend. Do not mirror them into `VITE_*` variables. If somebody suggests that, reject it.

## Migration Safety Rules

Before running migrations in staging or production:

1. Confirm the database name inside `DATABASE_URL` is the Ink Wave database, not another app.
2. Confirm the credential in use is scoped to Ink Wave or at least intentionally approved for this database.
3. Confirm the migration output is the checked-in `apps/api/drizzle` directory.
4. Run only the app package commands:
   - `pnpm --filter @workspace/api db:generate`
   - `pnpm --filter @workspace/api db:migrate`
   - `pnpm --filter @workspace/api db:drizzle-check`
5. Do not run ad hoc SQL against a guessed target unless incident response explicitly requires it and the target database has already been verified.

## Local Development Baseline

Local Docker PostgreSQL uses:

- database: `ink_wave_branding_app`
- host port: `5433`
- example connection string from `apps/api/.env.example`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ink_wave_branding_app
```

Local convenience does not weaken the production rule. Local and production should still target the same app-specific database name.

## Known Limitations And Honest Gaps

- This repo documents the target database shape. It does not prove the current Render instance is already provisioned exactly this way.
- This repo does not automate database-user creation on Render.
- This repo does not include a live smoke that validates the production `DATABASE_URL`.

That means operators still need to verify the actual Render database target before first deploy and before every migration run.
