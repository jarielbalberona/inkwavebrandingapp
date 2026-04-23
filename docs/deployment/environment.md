# Environment And Deployment Contract

This app deploys to Render and uses its own PostgreSQL database on a shared Render Postgres instance. Sharing the instance is acceptable for the MVP only if the database is logically isolated.

This document covers variable names, ownership boundaries, and where they belong. It does not give you permission to commit secrets.

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

Web variables belong in:

- local development: `apps/web/.env.example` copied to a local untracked `.env`
- Render web service: dashboard-managed environment values

If a variable contains a secret and somebody wants to place it in the web app, the design is wrong.

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

API variables belong in:

- local development: `apps/api/.env.example` copied to a local untracked `.env`
- Render API service: dashboard-managed environment values

Do not copy API secrets into the repo. Do not mirror API secrets into web variables. Do not put database credentials into shared documentation screenshots or chat snippets.

## Local Setup Files

Current safe example files:

- `apps/web/.env.example`
- `apps/api/.env.example`

Expected local workflow:

1. Copy each example file to a local untracked `.env`.
2. Replace placeholder secrets before starting the API.
3. Keep local values developer-specific. Do not standardize real secrets by committing them.

## Render Secret Management Rules

- `VITE_API_BASE_URL` is public and safe for the web service environment.
- `DATABASE_URL`, `AUTH_SESSION_SECRET`, and any future provider keys are backend-only.
- Render must store production and staging secrets in service environment settings, not in `render.yaml`.
- Rotate any secret immediately if it is ever committed, pasted into a public place, or shared in a frontend variable by mistake.

## Failure Modes To Avoid

- web points at the wrong API origin because `VITE_API_BASE_URL` drifted
- API boots against the wrong database because `DATABASE_URL` was copied from another app
- auth cookies break because `AUTH_SESSION_SECRET` is missing or too short
- someone runs seed/admin tasks with a reused weak password
- secrets leak because they were treated like setup documentation instead of credentials

## Current Render Status

`render.yaml` contains a live static web service definition because the web app has a buildable output at `apps/web/dist`.

`render.yaml` now defines the API service contract with `pnpm --filter @workspace/api start` and `/health`. That still does not remove the need to set real dashboard-managed environment values and run a live smoke.

## Migration Ownership

Drizzle is the forward migration owner. The generated migration output directory is `apps/api/drizzle`. Do not reintroduce another migration tool without a deliberate ticket and migration plan.
