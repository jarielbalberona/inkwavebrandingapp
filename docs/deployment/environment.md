# Environment And Deployment Contract

This app deploys to Render and uses its own PostgreSQL database on a shared Render Postgres instance. Sharing the instance is acceptable for the MVP only if the database is logically isolated.

## Required Isolation Rules

- Use a separate database for this app, for example `ink_wave_branding_app`.
- Prefer a separate database user/credential for this app.
- Do not point `DATABASE_URL` at another app database.
- Do not share schemas with another app.
- Run only checked-in Drizzle migrations generated from `apps/api/src/db/schema`.

## Web Environment

Frontend-safe variables must use the `VITE_` prefix.

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | yes | Public API base URL consumed by the browser. This is not a secret. |

## API Environment

Backend variables must not be exposed to the frontend bundle.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `development`, `test`, or `production`. |
| `PORT` | yes | API HTTP port. Render injects this; local default is `3000`. |
| `DATABASE_URL` | yes for DB/runtime | Must target this app's database only. |
| `DATABASE_SSL_MODE` | yes | Use `require` on Render unless local DB setup does not need SSL. |
| `AUTH_SESSION_SECRET` | yes for API runtime | At least 32 random characters. Used only for signing HTTP-only auth session cookies. |
| `AUTH_SESSION_TTL_SECONDS` | no | Session cookie lifetime. Defaults to 8 hours. |
| `WEB_ORIGIN` | yes for browser API calls | Exact frontend origin allowed for credentialed CORS, for example the Render web URL or `http://localhost:5173`. |
| `SENTRY_DSN` | no | Empty value disables Sentry initialization. |
| `SENTRY_TRACES_SAMPLE_RATE` | no | Number from `0` to `1`; default `0`. |
| `OPENAI_API_KEY` | no | Reserved for future API work. No OpenAI API calls exist yet. |
| `ADMIN_EMAIL` | seed only | Used by `pnpm --filter @workspace/api seed:admin`; not required for normal runtime. |
| `ADMIN_PASSWORD` | seed only | Must be a long generated value. Never commit a real password. |
| `ADMIN_DISPLAY_NAME` | seed only | Optional display name for the bootstrap admin. |

## Current Render Status

`render.yaml` contains a live static web service definition because the web app has a buildable output at `apps/web/dist`.

The API service is still commented out in `render.yaml`. It now has HTTP startup, `pnpm --filter @workspace/api start`, and `/health`, but it must not be enabled as a live Render service until deployment work wires real database/auth environment variables and performs a live smoke.

## Migration Ownership

Drizzle is the forward migration owner. The generated migration output directory is `apps/api/drizzle`. Do not reintroduce another migration tool without a deliberate ticket and migration plan.
