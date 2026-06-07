# Spec: Database Foundation

## ADDED Requirements

### Requirement: PostgreSQL-compatible local database foundation

The system SHALL use a PostgreSQL-compatible schema foundation with local PGlite storage so contributors can run database commands without installing an external database server.

#### Scenario: Local DB needs no Postgres service

- **WHEN** a developer runs the database migration command
- **THEN** it SHALL use local PGlite storage under the repository
- **AND** it SHALL NOT require Docker or a local PostgreSQL service.

### Requirement: Drizzle schema source of truth

The database schema SHALL be declared in TypeScript using Drizzle `pg-core` definitions under `packages/db/src/schema.ts`.

#### Scenario: Schema is imported by DB package

- **WHEN** `@rifa/db` is built
- **THEN** it SHALL export schema and client creation helpers.

### Requirement: Seller isolation baseline

Seller-owned data SHALL include seller scope through `seller_id` directly or through a parent relation.

#### Scenario: Seller tables are indexed

- **WHEN** orders, raffles, customers, notifications, or audit logs are queried
- **THEN** schema SHALL provide seller-scoped indexes for future API filtering.

### Requirement: Raffle number uniqueness

The system SHALL prevent duplicate numbers inside one raffle at the database constraint level.

#### Scenario: Duplicate number in same raffle

- **WHEN** two records share the same `raffle_id` and `number`
- **THEN** the database SHALL reject the duplicate.

### Requirement: Idempotency foundation

The schema SHALL include idempotency fields for order review and notification dispatch.

#### Scenario: Retried approval

- **WHEN** a future approval command is retried with the same idempotency key
- **THEN** the schema SHALL support detecting it safely.

### Requirement: Repeatable seed

The local seed SHALL be safe to run repeatedly without creating duplicate baseline data.

#### Scenario: Seed rerun

- **WHEN** the seed script runs more than once
- **THEN** it SHALL use deterministic IDs or conflict handling.

### Requirement: Existing scaffold gates remain green

The database foundation SHALL NOT break Phase 0 project discovery, linting, typechecking, formatting, or builds.

#### Scenario: Full verification

- **WHEN** the verification commands run
- **THEN** `pnpm projects`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and `pnpm build` SHALL pass.
