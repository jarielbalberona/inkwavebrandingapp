# Ink Wave Branding App

Internal operations app for Ink Wave cup printing. This repo is not a demo storefront and not a generic inventory sandbox. It exists to support cup catalog management, stock intake, inventory balances, order lifecycle, and basic reporting with real admin/staff access control.

## Workspace shape

Current packages:

- `apps/api`: Node.js + TypeScript backend package for database, auth, and domain modules
- `apps/web`: React + TypeScript + Vite frontend
- `packages/ui`: shared UI primitives used by the frontend

Rules:

- Feature code does not belong in `packages/ui`.
- Backend code does not belong in `apps/web`.
- Shared UI stays reusable and business-logic free.
- Implementation happens directly on `main` for this repo.

## Commands

Run from the repo root:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm typecheck
```

Package-level examples:

```bash
pnpm --filter @workspace/api typecheck
pnpm --filter @workspace/api db:check
pnpm --filter @workspace/api db:generate
pnpm --filter @workspace/api db:migrate
pnpm --filter @workspace/api db:drizzle-check
pnpm --filter @workspace/api seed:admin
pnpm --filter @workspace/ui lint
pnpm --filter web typecheck
```

## Deployment

- Initial Render contract lives in `render.yaml`.
- Deployment/env details live in `docs/deployment/environment.md`.
- Database provisioning/isolation notes live in `docs/deployment/database.md`.
- Deployment runbook notes live in `docs/deployment/deploy.md`.
- Logging/incident notes live in `docs/deployment/observability.md`.
- The current Render web service is buildable as a static site.
- The current Render API service contract targets `pnpm --filter @workspace/api build`, `pnpm --filter @workspace/api start`, and `/health`.
- Render config is source-controlled, but live deployment still requires dashboard-managed environment values and an actual smoke.

## Conventions

- Root scripts are orchestrated through Turbo.
- `apps/web` remains the frontend entrypoint.
- `packages/ui` exports shared primitives only.
- Future backend work should land under `apps/api`, not as utilities inside the web app.
- If a check fails because of real repo debt, document the blocker instead of pretending the workspace is green.

## Shared config baseline

- Shared TypeScript baselines live at the repo root:
  - `tsconfig.base.json`
  - `tsconfig.react.json`
  - `tsconfig.node.json`
- Frontend packages should extend the shared React config instead of copy-pasting compiler settings.
- Node/Vite config files should extend the shared Node config.
- `apps/web` should consume `@workspace/ui` through package exports, not through direct path-mapping into `packages/ui/src`.

## Environment boundary

- Frontend-safe variables belong under `apps/web` and must use the `VITE_` prefix.
- Backend-only secrets belong under `apps/api` when that package is added and must never be imported into `packages/ui` or browser code.
- `packages/ui` stays environment-agnostic. If a component needs runtime secrets, the design is wrong.

## Database setup baseline

- The app targets PostgreSQL only.
- `apps/api` uses Drizzle ORM on top of the existing `pg` pool.
- `apps/api/.env.example` documents the required DB env variables.
- `DATABASE_URL` must point to the Ink Wave app database, not another schema/application on the shared Render instance.
- Drizzle schema exports start in `apps/api/src/db/schema`.
- Drizzle migration output is `apps/api/drizzle`.
- Drizzle is the forward migration owner; do not add a second migration tool without a deliberate ticket.
- Use the API package Drizzle scripts; do not hand-run untracked schema changes.

## Local PostgreSQL with Docker Compose

The app services still run on the host through `pnpm` + Turbo. Docker Compose is only for local PostgreSQL.

Files:

- `docker-compose.dev.yml` starts a local PostgreSQL container
- `apps/api/.env.example` includes a copy-paste local `DATABASE_URL`

This machine already has `5432` occupied, so the local dev database is exposed on `5433`.

Use this local API database config:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ink_wave_branding_app
DATABASE_SSL_MODE=disable
```

Commands:

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml down -v
```

- `up -d` starts PostgreSQL in the background
- `down` stops and removes the container but keeps the named volume
- `down -v` wipes the local database volume and resets all local data

After the container is healthy, run API migrations from the host:

```bash
pnpm --filter @workspace/api db:migrate
```

## API runtime foundations

- `apps/api/src/config/env.ts` is the central Zod-backed env contract.
- Sentry is configured through `SENTRY_DSN` and stays disabled when no DSN is set.
- `OPENAI_API_KEY` is optional scaffolding for future API work only; the app does not call OpenAI APIs yet.

## Shared UI usage

Add shadcn components against the web config so generated primitives stay in `packages/ui`:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Import shared UI from the workspace package:

```tsx
import { Button } from "@workspace/ui/components/button";
```
