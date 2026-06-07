# Architecture Foundation

## Ownership Model

The workspace separates deployable applications from shared infrastructure:

```txt
apps/public-web  -> shared, validation, config
apps/admin-web   -> shared, validation, config
apps/api         -> shared, validation, config, db
packages/db      -> shared, config
```

Web apps must never import DB internals. API owns seller scoping, business transactions, private proof access, audit logs, and post-commit job creation.

## Seller Isolation Baseline

Seller-owned records and contracts carry `sellerId`. Future API behavior must derive seller scope from the authenticated actor, not from client-provided seller identifiers. Cross-seller access should reject or return no data.

## Manual Proof Assumptions

Payment proofs are private storage objects. Public responses and Telegram/email notifications must not expose public proof URLs or full documents. Admin access should use authenticated streaming or short-lived signed URLs.

## Idempotent Approval Invariant

Approval is designed as a future atomic DB transaction:

1. Lock order by `orderId` and `sellerId`.
2. Require pending-review status and proof metadata.
3. Lock selected or candidate raffle numbers.
4. Assign each number once per raffle.
5. Mark the order paid, write immutable participation evidence, and audit the action.
6. Commit first, then enqueue notifications.

Repeated approval must be safe: an already-paid order must not create duplicate assignments or duplicate durable side effects.

## Notification Jobs After Commit

Email and Telegram delivery are durable post-commit jobs. Provider failures must be logged and retried without rolling back order approval.

## Database Foundation

The project uses Drizzle with PostgreSQL schema definitions. Local development uses PGlite at `packages/db/pglite-data`, which avoids installing Docker or PostgreSQL locally while keeping PostgreSQL semantics from the beginning.

Production/VPS should use a real PostgreSQL server. Before production deployment, migrations must be reviewed against PostgreSQL directly because PGlite is a local development database, not the production runtime.

Core DB invariants:

- Raffle slugs are unique per seller.
- Raffle numbers are unique per raffle.
- Order-number links prevent double assignment.
- Review and notification idempotency keys protect retries.
- Seller-owned tables carry seller scope for future API filtering.

## Deferred Decisions

- Proof storage provider and local emulator.
- Email provider and queue deployment profile.
