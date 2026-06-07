# Rifa Platform

Phase 0 initializes the executable foundation for a flexible raffle platform. The repo is a minimal `pnpm` + Nx monorepo with scaffold-only apps, shared contracts, validation/config boundaries, and a DB ownership guard.

Phase 1 adds the local database foundation with Drizzle and PGlite. PGlite gives us PostgreSQL-compatible local storage without installing Docker or a PostgreSQL service. Future VPS deployment should use real PostgreSQL with the same schema intent.

## Workspace

### Apps

- `apps/public-web` — future public raffle purchase experience. Phase 0 only exports a TypeScript health contract.
- `apps/admin-web` — future seller/admin operations UI. Phase 0 only exports a TypeScript health contract.
- `apps/api` — future API, transaction, auth, storage, and job boundary. It is the only app allowed to import `@rifa/db`.

### Packages

- `packages/shared` — canonical runtime constants as `as const` objects plus derived TypeScript types.
- `packages/validation` — scaffold Zod contracts that import constants from `@rifa/shared`.
- `packages/config` — typed environment key contracts and secret names only; no real secrets.
- `packages/db` — Drizzle PostgreSQL schema, PGlite local client, migrations, seed, and future DB invariants.

## Phase 0 Non-goals

The foundation intentionally does not implement raffle UI, API endpoints, auth, file upload, email, Telegram delivery, or payment integrations.

## Commands

```bash
pnpm install
pnpm nx show projects
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

## Local Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Local data is stored under:

```txt
packages/db/pglite-data
```

That folder is ignored by Git. No local PostgreSQL installation is required.

## Boundary Guard

Nx/ESLint module boundaries allow web apps to import `@rifa/shared`, `@rifa/validation`, and `@rifa/config`. Only `apps/api` may import `@rifa/db`. A web import from `@rifa/db` is expected to fail during `pnpm lint`.
