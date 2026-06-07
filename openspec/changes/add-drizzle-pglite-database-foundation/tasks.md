# Tasks: Add Drizzle PGlite Database Foundation

## Phase 1: Database Foundation

- [x] 1.1 Add dependencies for Drizzle, drizzle-kit, PGlite, and TS script execution.
- [x] 1.2 Add DB package layout: `drizzle.config.ts`, `src/schema.ts`, `src/client.ts`, `src/seed.ts`, and migration output folder.
- [x] 1.3 Define PostgreSQL-compatible Drizzle schema for sellers, users, raffles, prizes, numbers, customers, orders, order numbers, draw results, notification logs, and audit logs.
- [x] 1.4 Add indexes and unique constraints for seller isolation, raffle slugs, number uniqueness, order-number uniqueness, review idempotency, and notification idempotency.
- [x] 1.5 Add local PGlite client helper and exports from `@rifa/db`.
- [x] 1.6 Add idempotent seed data for one seller, one admin user placeholder, one sample raffle, prizes, and numbers.
- [x] 1.7 Add root scripts: `db:generate`, `db:migrate`, `db:seed`, `db:studio`, and `db:check`.
- [x] 1.8 Add `.env.example`, update `.gitignore`, README, architecture, and verification docs for PGlite local and future VPS PostgreSQL.
- [x] 1.9 Run database verification: generate migration, apply migration, run seed.
- [x] 1.10 Run full scaffold gates: `pnpm projects`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.

## Implementation Evidence

- Generated migration: `packages/db/drizzle/0000_flaky_shinobi_shaw.sql`.
- Applied migration with `pnpm db:migrate` to local PGlite storage.
- Ran `pnpm db:seed` twice successfully to verify seed idempotency.
- Full gates passed: `pnpm projects`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
- Scaffold fixes applied: PGlite path changed from nested `.data/pglite` to `packages/db/pglite-data` on Windows; `packages/db/tsconfig.lib.json` now includes Node types for `process`.
