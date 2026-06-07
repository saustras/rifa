# Superseded Proposal: Add SQLite Prisma Database Foundation

> Superseded by `add-drizzle-pglite-database-foundation` after deciding the project should keep PostgreSQL semantics from day one for future VPS deployment while still avoiding a local Postgres installation.

## Intent

Create the Phase 1 local database foundation without requiring Fede to install an external DB. Use a SQLite file through Prisma now, while keeping schema/migration choices compatible with a future PostgreSQL move.

## Scope

### In Scope

- Add Prisma foundation: schema, local SQLite datasource, migrations, seed, and package scripts.
- Model initial entities: sellers, users, raffles, prizes, numbers, customers, orders, order_numbers, draw_results, notification_logs, audit_logs.
- Define constraints/indexes for idempotency, seller isolation, auditability, and future PostgreSQL migration.

### Out of Scope

- Product API endpoints, UI screens, auth implementation, payments, notifications delivery, or draw execution logic.
- Production PostgreSQL deployment; only prepare portability.

## Approach

Use Prisma with `DATABASE_URL="file:./dev.db"`. Keep IDs, relations, timestamps, unique keys, enums, and decimal/date usage PostgreSQL-friendly. Seed deterministic minimal demo data. Scripts should cover generate, migrate dev, reset/seed, and DB inspection.

## Affected Areas

| Area                   | Impact   | Description                                  |
| ---------------------- | -------- | -------------------------------------------- |
| `prisma/schema.prisma` | New      | SQLite Prisma schema and entity relations.   |
| `prisma/migrations/`   | New      | Initial migration for the foundation schema. |
| `prisma/seed.*`        | New      | Idempotent local seed data.                  |
| `package.json`         | Modified | Prisma scripts and seed command only.        |
| `.env.example`         | Modified | Local SQLite `DATABASE_URL` example.         |

## Risks

| Risk                                | Likelihood | Mitigation                                                             |
| ----------------------------------- | ---------- | ---------------------------------------------------------------------- |
| SQLite/PostgreSQL drift             | Med        | Avoid SQLite-only assumptions; document provider switch steps.         |
| Duplicate orders/numbers on retries | Med        | Add unique idempotency keys and composite constraints.                 |
| Cross-seller data leakage           | High       | Every tenant-owned table references `sellerId`; add composite indexes. |
| Sensitive audit/security gaps       | Med        | Include audit logs, immutable timestamps, and no secrets in seed.      |

## Rollback Plan

Delete this change's Prisma files/scripts before implementation, or after implementation revert the Prisma schema, migration folder, seed, package scripts, and `.env.example` changes. Remove local `dev.db` files if generated.

## Dependencies

- `prisma` and `@prisma/client`; no external database service.

## Success Criteria

- [ ] Prisma generates a client against SQLite without external DB installation.
- [ ] Initial migration creates all listed entities with relations, indexes, and uniqueness constraints.
- [ ] Seed can run repeatedly without duplicates.
- [ ] Verification documents seller isolation, idempotency, and PostgreSQL migration readiness.
