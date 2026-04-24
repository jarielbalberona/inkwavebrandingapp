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
| `DATABASE_URL` | yes unless split DB vars are used | Must target this app's database only. Local development usually uses this. |
| `DATABASE_HOST` | yes as part of split DB mode | Preferred on Render when dashboard-managed passwords may contain URL-reserved characters. |
| `DATABASE_PORT` | no | Defaults to `5432` when split DB mode is used. |
| `DATABASE_USER` | yes as part of split DB mode | Database user for split DB mode. |
| `DATABASE_PASSWORD` | yes as part of split DB mode | Database password for split DB mode. |
| `DATABASE_NAME` | yes as part of split DB mode | Ink Wave database name for split DB mode. |
| `DATABASE_SSL_MODE` | yes | Use `require` on Render unless local DB setup does not need SSL. |
| `AUTH_SESSION_SECRET` | yes for API runtime | At least 32 random characters. Used only for signing HTTP-only auth session cookies. |
| `AUTH_SESSION_TTL_SECONDS` | no | Session cookie lifetime. Defaults to 8 hours. |
| `AUTH_SESSION_SAME_SITE` | no | `lax`, `strict`, or `none`. If omitted, defaults to `lax` in development and `none` in production so session cookies are sent on cross-site API calls (typical when the static site and API use different hostnames, for example on Render). |
| `WEB_ORIGIN` | yes for browser API calls | Exact frontend origin allowed for credentialed CORS, for example the Render web URL or `http://localhost:5173`. |
| `SENTRY_DSN` | no | Empty value disables Sentry initialization. |
| `SENTRY_TRACES_SAMPLE_RATE` | no | Number from `0` to `1`; default `0`. |
| `OPENAI_API_KEY` | no | Reserved for future API work. No OpenAI API calls exist yet. |
| `STORAGE_PROVIDER` | no | `none` or `r2`. Defaults to `none`. Set to `r2` only when R2-backed document storage is intentionally enabled. |
| `R2_ACCOUNT_ID` | required when `STORAGE_PROVIDER=r2` | Used to derive the default Cloudflare R2 S3-compatible endpoint when `R2_ENDPOINT` is not set. |
| `R2_ACCESS_KEY_ID` | required when `STORAGE_PROVIDER=r2` | Cloudflare R2 access key ID. Backend-only secret material. |
| `R2_SECRET_ACCESS_KEY` | required when `STORAGE_PROVIDER=r2` | Cloudflare R2 secret access key. Backend-only secret material. |
| `R2_BUCKET_NAME` | required when `STORAGE_PROVIDER=r2` | Target bucket for stored assets. |
| `R2_ENDPOINT` | no | Optional explicit S3-compatible endpoint override. If omitted, the API derives `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. |
| `R2_PUBLIC_URL` | required when `STORAGE_PROVIDER=r2` and `R2_USE_PUBLIC_CDN=true` | Public base URL for asset delivery, typically a custom CDN/domain in front of R2. |
| `R2_USE_PUBLIC_CDN` | no | `true` by default. When `false`, the API treats stored objects as non-public and will not derive public URLs. |
| `UPLOAD_MAX_FILE_BYTES` | no | Default per-object upload ceiling. Current default is `5242880` (5 MiB). |
| `UPLOAD_MAX_REQUEST_BYTES` | no | Default total request ceiling for multipart-style upload flows. Current default is `52428800` (50 MiB). |
| `ADMIN_EMAIL` | seed only | Used by `pnpm --filter @workspace/api seed:admin`; not required for normal runtime. |
| `ADMIN_PASSWORD` | seed only | Must be a long generated value. Never commit a real password. |
| `ADMIN_DISPLAY_NAME` | seed only | Optional display name for the bootstrap admin. |

API variables belong in:

- local development: `apps/api/.env.example` copied to a local untracked `.env`
- Render API service: dashboard-managed environment values

Render-specific preference:

- local development usually uses `DATABASE_URL`
- Render should prefer the split `DATABASE_*` path because pasted dashboard passwords frequently contain `@`, `#`, and similar characters
- do not set both modes carelessly and assume they are equivalent; the runtime prefers the complete split `DATABASE_*` set when all required fields are present

Do not copy API secrets into the repo. Do not mirror API secrets into web variables. Do not put database credentials into shared documentation screenshots or chat snippets.

## Storage Contract Notes

- Storage config is now centralized in `apps/api/src/config/storage.ts`.
- Feature modules must consume resolved storage config/provider wiring instead of reading raw `process.env` values.
- If `STORAGE_PROVIDER=r2`, the API fails during startup when required R2 variables are missing. That is intentional. Runtime surprise failures are worse.
- Ink Wave does not yet claim a generic browser-upload surface. The initial storage integration is for durable invoice document persistence, with generic multipart uploads deferred until the app has a real business need.

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
- `DATABASE_URL` / split `DATABASE_*`, `AUTH_SESSION_SECRET`, and any future provider keys are backend-only.
- Render must store production and staging secrets in service environment settings, not in `render.yaml`.
- Rotate any secret immediately if it is ever committed, pasted into a public place, or shared in a frontend variable by mistake.

## Failure Modes To Avoid

- web points at the wrong API origin because `VITE_API_BASE_URL` drifted
- API boots against the wrong database because `DATABASE_URL` or split `DATABASE_*` values were copied from another app
- auth cookies break because `AUTH_SESSION_SECRET` is missing or too short
- someone runs seed/admin tasks with a reused weak password
- secrets leak because they were treated like setup documentation instead of credentials

## Current Render Status

`render.yaml` contains a live static web service definition because the web app has a buildable output at `apps/web/dist`.

`render.yaml` now defines the API service contract with `pnpm --filter @workspace/api start` and `/health`. That still does not remove the need to set real dashboard-managed environment values and run a live smoke.

Bootstrap admin truth:

- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_DISPLAY_NAME` are not normal runtime requirements
- they are only needed for `pnpm --filter @workspace/api seed:admin`
- after the first bootstrap, use the in-app `/users` management flow for ongoing staff/admin changes instead of treating the seed task like account management

## Migration Ownership

Drizzle is the forward migration owner. The generated migration output directory is `apps/api/drizzle`. Do not reintroduce another migration tool without a deliberate ticket and migration plan.
