# Proposal: Add Drizzle PGlite Database Foundation

## Intent

Create the Phase 1 database foundation using Drizzle with PostgreSQL schema semantics and PGlite for local development, so Fede can run the app without installing PostgreSQL while preserving a clean path to a future VPS PostgreSQL deployment.

## Scope

### In Scope

- Add Drizzle ORM and drizzle-kit configuration under `packages/db`.
- Use PGlite as the local no-server PostgreSQL-compatible database.
- Define the initial relational schema for sellers, users, raffles, prizes, numbers, customers, orders, order numbers, draw results, notification logs, and audit logs.
- Add indexes and unique constraints for seller isolation, slugs, number uniqueness, idempotency, and review consistency.
- Add root/package scripts for migration generation, migration application, studio, and seed.
- Add `.env.example` and documentation for local PGlite and future VPS PostgreSQL.

### Out of Scope

- Product API endpoints, UI screens, auth flows, payment review UI, Telegram delivery, email delivery, and draw-result workflows.
- Production deployment automation.
- Migrating real data to a VPS database.

## Approach

Use `drizzle-orm` with `pg-core` schema definitions and `drizzle-kit` configured with `dialect: "postgresql"` and `driver: "pglite"`. Local data is stored under `packages/db/pglite-data`, ignored by Git. Future VPS deployment can use a real PostgreSQL connection while keeping the same schema model and migrations conceptually aligned with PostgreSQL.

## Risks

| Risk                          | Mitigation                                                             |
| ----------------------------- | ---------------------------------------------------------------------- |
| Duplicate raffle numbers      | Composite unique constraint on `(raffle_id, number)`.                  |
| Double approval/rejection     | Idempotency keys and future transactional order review.                |
| Cross-seller leakage          | `seller_id` on seller-owned tables and indexes by seller scope.        |
| Local/production drift        | Use PostgreSQL dialect from day one instead of SQLite-specific schema. |
| Sensitive proof/audit leakage | Store metadata only now; future proof URLs remain private/signed.      |

## Success Criteria

- Drizzle projects and scripts are discoverable from the monorepo.
- Migration generation works locally without external DB installation.
- Migrations apply to local PGlite storage.
- Seed can run repeatedly without duplicate demo data.
- Existing Phase 0 gates still pass: projects, lint, typecheck, format, build.
