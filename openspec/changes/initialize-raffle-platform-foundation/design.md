# Design: Initialize Raffle Platform Foundation

## Technical Approach

Phase 0 creates only the executable foundation for the PRD: a `pnpm` + Nx monorepo with three apps and four shared packages. The current repo contains only `docs/prd.md` and the OpenSpec proposal, so there are no existing runtime patterns to preserve. Product flows stay as contracts and boundaries; UI, endpoints, migrations, auth, and integrations are deferred.

## Architecture Decisions

| Decision          | Choice                                                                                                                                           | Alternatives considered                          | Rationale                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Monorepo boundary | `apps/*` for deployables, `packages/*` for shared infrastructure                                                                                 | Single app; feature folders only                 | Separate public, admin, API, DB, validation, config, and shared contracts early so MVP features do not create cross-app coupling.                                |
| Runtime stack     | React + Vite for `public-web`/`admin-web`, Node.js HTTP + TypeScript for `api`, PostgreSQL-compatible Drizzle/PGlite locally, Redis/BullMQ later | Next.js full-stack; NestJS API                   | Keeps the first API foundation simple and avoids decorator/runtime friction; API transactions/jobs remain centralized and public/admin deploys stay independent. |
| Domain constants  | Export `as const` objects plus derived types from `packages/shared`; avoid handwritten direct unions                                             | Direct TS unions like `'paid'                    | 'rejected'`; DB-only enums                                                                                                                                       | Const objects give runtime values for validation/UI/API while preserving type safety and avoiding drift. |
| Isolation         | Every seller-owned entity carries `sellerId`; API derives seller scope from authenticated actor and never trusts client `sellerId`               | Global records with filters; future-only tenancy | Prevents leakage now and prepares SaaS without rebuilding the model.                                                                                             |
| Jobs              | API writes durable notification/email jobs after commits                                                                                         | Send inline inside transactions                  | Approval must not roll back because SMTP/Telegram failed; failures become retryable logs.                                                                        |

## App / Package Responsibilities

- `apps/public-web`: public raffle pages, number selection/count entry, proof upload UX; consumes validation/shared contracts only.
- `apps/admin-web`: seller/admin dashboard, raffle management, order review drawer, audit/export screens; never imports DB internals.
- `apps/api`: auth boundary, seller scoping, business transactions, file upload policy, job producers, external provider adapters.
- `packages/db`: schema, migrations, seeds, transaction helpers, constraints (`unique(raffle_id, number)`, `unique(order_id, raffle_number_id)`).
- `packages/shared`: statuses, roles, assignment modes, audit/notification constants, DTO primitives.
- `packages/validation`: Zod request/response schemas built from shared const objects.
- `packages/config`: env schema, secret names, typed config loading.

## Domain Model Boundaries

Core aggregates: `Seller`, `User`, `Raffle`, `RafflePrize`, `RaffleNumber`, `Customer`, `Order`, `OrderNumber`, `DrawResult`, `NotificationLog`, `AuditLog`. `Raffle` owns number range/config; `Order` owns buyer intent/payment review; `RaffleNumber` owns availability; `OrderNumber` is immutable participation evidence after approval.

## Data Flow

```txt
Public/Admin Web -> API validation -> seller-scoped service -> DB transaction
                                      -> audit log
                                      -> post-commit jobs -> email/Telegram adapters
```

Approval future design:

```txt
BEGIN
  lock order by id + seller_id
  require status=pending_review and proof present
  lock raffle_numbers by raffle_id and requested ids/random candidate set
  assign/reserve transition: reserved|available -> assigned
  set order=paid, reviewed fields
  insert order_numbers + audit_log
COMMIT
enqueue email/notification jobs
```

## Number Reservation / Assignment Rules

- `customer_choice`: create pending order with selected numbers `reserved`; reserved numbers are hidden from availability until approval, rejection, cancellation, or TTL expiry.
- `random`: order stores `numbersRequested`; final numbers are selected only during approval from locked `available` numbers.
- A number cannot be assigned twice; DB uniqueness and row locks are mandatory.
- Rejection releases reserved numbers by default; blocking is an explicit admin policy/action.

## File / Proof Security Assumptions

Payment proofs are private objects in S3-compatible storage, never public URLs. API validates MIME, extension, size, and ownership; admin access uses authenticated streaming or short-lived signed URLs. Telegram messages contain summaries and secure links only, never documents or full proofs.

## Verification Gates

| Gate                    | Command / Evidence                                       |
| ----------------------- | -------------------------------------------------------- |
| Install reproducibility | `pnpm install` succeeds from clean checkout              |
| Project graph           | Nx graph lists all apps/packages with legal dependencies |
| Static quality          | `pnpm lint`, `pnpm typecheck`, `pnpm format:check` pass  |
| Build readiness         | `pnpm build` or Nx affected build succeeds for scaffold  |
| Boundary safety         | API is the only app allowed to import `packages/db`      |

## Migration / Rollout

No data migration required. Phase 0 is scaffold-only and can be reverted as one workspace/config change.

## Open Questions

- [ ] Choose exact DB ORM/migration tool for `packages/db`.
- [ ] Choose default storage provider and local-dev proof storage emulator.
- [ ] Choose email provider and queue deployment profile for MVP.
