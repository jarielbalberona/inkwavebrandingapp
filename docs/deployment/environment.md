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
| `DATABASE_URL` | yes for DB/runtime | Must target this app's database only. |
| `DATABASE_SSL_MODE` | yes | Use `require` on Render unless local DB setup does not need SSL. |
| `SENTRY_DSN` | no | Empty value disables Sentry initialization. |
| `SENTRY_TRACES_SAMPLE_RATE` | no | Number from `0` to `1`; default `0`. |
| `OPENAI_API_KEY` | no | Reserved for future API work. No OpenAI API calls exist yet. |

## Current Render Status

`render.yaml` contains a live static web service definition because the web app has a buildable output at `apps/web/dist`.

The API service is documented as a skeleton only. It must not be enabled as a live Render service until a later ticket adds:

- HTTP server startup
- `start` script for `@workspace/api`
- `/health` or equivalent health check
- runtime smoke verification

## Migration Ownership

Drizzle is the forward migration owner. The generated migration output directory is `apps/api/drizzle`. Do not reintroduce another migration tool without a deliberate ticket and migration plan.
