# Render Rollout Checklist

This is the practical operator checklist for deploying Ink Wave on Render.

If somebody says “it should be fine” and skips this list, they are freelancing with production.

## 1. Repo-Side Readiness

Run from the repo root before touching Render:

```bash
pnpm deploy:check
```

This proves only the repo-side readiness path:

- API typecheck/build
- checked-in Drizzle artifacts pass `db:drizzle-check`
- web typecheck/build

This does **not** prove:

- live Render env values
- live database target
- live browser behavior
- live R2/document delivery

## 2. Render API Service Env

Confirm the API service has the required env values:

- `NODE_ENV=production`
- split DB vars:
  - `DATABASE_HOST`
  - `DATABASE_PORT`
  - `DATABASE_USER`
  - `DATABASE_PASSWORD`
  - `DATABASE_NAME`
- `DATABASE_SSL_MODE=require`
- `AUTH_SESSION_SECRET`
- `WEB_ORIGIN`

Optional but expected in this app:

- `AUTH_SESSION_TTL_SECONDS`
- `AUTH_SESSION_SAME_SITE`
- `SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE`
- `OPENAI_API_KEY`
- `EMAIL_PROVIDER`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL`
- `STORAGE_PROVIDER`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- `R2_PUBLIC_URL`
- `R2_USE_PUBLIC_CDN`
- `UPLOAD_MAX_FILE_BYTES`
- `UPLOAD_MAX_REQUEST_BYTES`

Bootstrap-only, not steady-state runtime:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_DISPLAY_NAME`

## 2.5. Render Daily Digest Cron Env

Confirm the `ink-wave-branding-daily-digest` cron service has:

- `NODE_ENV=production`
- split DB vars:
  - `DATABASE_HOST`
  - `DATABASE_PORT`
  - `DATABASE_USER`
  - `DATABASE_PASSWORD`
  - `DATABASE_NAME`
- `DATABASE_SSL_MODE=require`
- `WEB_ORIGIN`
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL` if reply-to behavior is required

Schedule truth:

- Render cron expression: `30 9 * * 1-5`
- Business meaning: **5:30 PM Asia/Manila**, Monday to Friday only
- Manila has no DST, so this UTC conversion is stable year-round

## 3. Render Web Service Env

Confirm the static web service has:

- `VITE_API_BASE_URL`

That value must point at the real deployed API origin, not localhost and not a stale preview URL.

## 4. Database Target Verification

Before deploying migrations, verify the target database is really Ink Wave’s database:

- confirm the Render database name is the intended Ink Wave database
- confirm the credential is intentionally scoped to that database
- confirm nobody copied another app’s DB values into this service

If you are using a manual shell against the target env, run:

```bash
pnpm --filter @workspace/api db:check
```

Do not run migrations against a guessed target.

## 5. API Deploy

Deploy the API service first.

Expected Render behavior from `render.yaml`:

- build command installs dependencies and builds `@workspace/emails`, `@workspace/pdfs`, and `@workspace/api`
- predeploy runs `pnpm --filter @workspace/api db:migrate:deploy`
- start command runs `pnpm --filter @workspace/api start`
- health check is `/health`

If the predeploy migration fails, stop. Do not “just retry” until you know why.

## 6. Web Deploy

Deploy the web service after the API is healthy.

Expected Render behavior from `render.yaml`:

- static publish path: `apps/web/dist`
- SPA rewrite sends `/*` to `/index.html`

If the rewrite is missing in the live service, deep links are broken even if the homepage loads.

## 7. Bootstrap Admin

Only if this is a brand-new database:

```bash
pnpm --filter @workspace/api seed:admin
```

Rules:

- use a long generated password
- treat this as the first bootstrap step only
- after bootstrap, manage staff/admin users from the app’s `/users` UI instead of repeated seed runs
- remove long-lived bootstrap env values if they are no longer needed

## 8. Live Smoke

Minimum live checks:

### Platform

- API `/health` returns `200`
- web app loads
- browser requests point to the intended API origin
- refreshing a deep link such as `/products`, `/orders`, or `/invoices` does not 404

### Auth

- admin can log in
- logout clears the session
- protected routes reject unauthenticated access

### Core Product Smoke

- cups page loads
- lids page loads
- general items page loads
- inventory balances page loads
- orders list/detail load

### Invoice Smoke

- invoice list/detail load
- invoice PDF opens
- if R2/CDN is enabled, share-link behavior matches the configured visibility model
- invoice payment actions still work
- invoice totals/status remain truthful after payment activity

### Email Setup Smoke

- `EMAIL_PROVIDER=none` boots cleanly without requiring Resend secrets
- `EMAIL_PROVIDER=resend` is not enabled unless `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set
- `pnpm --filter @workspace/emails build`
- `pnpm --filter @workspace/emails typecheck`
- `pnpm --filter @workspace/emails test`
- `pnpm --filter @workspace/emails render DailyBusinessDigestEmail`
- `pnpm --filter @workspace/emails render LowStockAlertEmail`
- preview HTML reflects Ink Wave terminology and current order/invoice model

### Daily Digest Scheduler Smoke

- `pnpm --filter @workspace/api exec node --import tsx src/modules/notifications/run-daily-digest.ts --business-date=YYYY-MM-DD` runs the digest for an explicit Manila business date
- `pnpm --filter @workspace/api exec node --import tsx src/modules/notifications/run-scheduled-daily-digest.ts` uses the current Manila business date and skips weekends
- verify the digest runner writes `notification_digest_runs`, `notification_digest_deliveries`, and `notification_digest_delivery_attempts`
- verify rerunning the same business date does not create a second successful send for the same recipient
- after deploy, confirm the Render cron service last-run history matches weekday-only expectations

This proves the package/seam, scheduler path, and digest delivery logic are real in the repo. It does **not** prove live Render env correctness or live Resend delivery until an operator checks the deployed service.

## 9. What Still Requires Human/Live Proof

This repo cannot prove these from local code alone:

- the actual Render dashboard env values
- the actual database target selected in Render
- the actual deployed URL health
- browser behavior against the deployed services
- live R2 credentials/CDN behavior
- live Resend acceptance and sender-domain status
- live Render cron execution history for the digest service

If those checks were not done, say so explicitly. Do not mark rollout verified from repo work alone.
