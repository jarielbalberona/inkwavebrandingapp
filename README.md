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
pnpm --filter @workspace/api migrate:create init_schema
pnpm --filter @workspace/api migrate:up
pnpm --filter @workspace/ui lint
pnpm --filter web typecheck
```

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
- `apps/api/.env.example` documents the required DB env variables.
- `DATABASE_URL` must point to the Ink Wave app database, not another schema/application on the shared Render instance.
- Checked-in migrations live under `apps/api/migrations`.
- Use the API package migration scripts; do not hand-run untracked schema changes.

## Shared UI usage

Add shadcn components against the web config so generated primitives stay in `packages/ui`:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Import shared UI from the workspace package:

```tsx
import { Button } from "@workspace/ui/components/button";
```
