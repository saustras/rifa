# Design: Add Drizzle PGlite Database Foundation

## Decision

Use Drizzle ORM with PostgreSQL schema definitions and PGlite for local development.

```txt
Local: Drizzle + PGlite stored in packages/db/pglite-data
Future VPS: Drizzle + PostgreSQL real server
```

This keeps Fede's local setup simple while avoiding the SQLite-to-PostgreSQL migration mismatch.

## Package Layout

```txt
packages/db/
  drizzle.config.ts
  drizzle/
    migrations/
  src/
    client.ts
    index.ts
    schema.ts
    seed.ts
```

## Schema Boundaries

- `sellers`: organization/seller ownership root.
- `users`: seller-scoped admin users.
- `raffles`: configurable raffle campaign.
- `raffle_prizes`: ordered prizes for a raffle.
- `raffle_numbers`: available/reserved/assigned/blocked/winner numbers.
- `customers`: buyer data scoped to a seller.
- `orders`: manual proof purchase intent and review state.
- `order_numbers`: immutable link between approved/reserved order and numbers.
- `draw_results`: external lottery/sort evidence.
- `notification_logs`: durable email/Telegram delivery log.
- `audit_logs`: append-only sensitive action log.

## Invariants

- Every seller-owned table carries `seller_id` directly or through a parent relation.
- `raffles` use `unique(seller_id, slug)`.
- `raffle_numbers` use `unique(raffle_id, number)`.
- `order_numbers` use `unique(order_id, raffle_number_id)` and `unique(raffle_number_id)` for final ownership safety.
- Orders carry `review_idempotency_key` to protect approval/rejection retries.
- Notification logs carry `idempotency_key` for retry-safe dispatch.

## Future Approval Transaction

```txt
BEGIN
  lock order by id + seller_id
  require status = pending_review
  require proof metadata exists
  lock selected numbers or random available candidate numbers
  insert order_numbers
  transition numbers to assigned
  transition order to paid
  insert audit log
COMMIT
enqueue email + Telegram jobs
```

## Local and VPS Strategy

Local PGlite needs no external installation. VPS PostgreSQL later should use the same Drizzle schema intent. Before production, run a migration review against real PostgreSQL because PGlite is development convenience, not the production database.

## Verification

- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm projects`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm build`
