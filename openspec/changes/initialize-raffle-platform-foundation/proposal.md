# Proposal: Initialize Raffle Platform Foundation

## Problem

The PRD defines a flexible raffle platform, but the repo has no executable foundation. Phase 0 must establish monorepo structure, architecture boundaries, shared contracts, config, and DB/job foundations before product features.

## Goals

- Initialize a `pnpm` + Nx monorepo.
- Define app boundaries: `apps/public-web`, `apps/admin-web`, `apps/api`.
- Define package boundaries: `packages/db`, `packages/shared`, `packages/validation`, `packages/config`.
- Prepare foundations for manual proof payments, raffle assignment modes (`random`, `customer_choice`), Telegram notifications, email jobs, seller isolation, and idempotent approval transactions.

## Non-Goals

- No product UI, API endpoints, auth flows, database migrations, or payment-provider integrations in this phase.
- No automatic winner selection, marketplace, billing SaaS, WhatsApp, or automated payment webhooks.

## Scope

### In Scope

- Workspace/tooling proposal for Nx, pnpm, lint/format/test scripts, and boundaries.
- Initial contracts for apps, API, shared packages, env config, validation, and DB ownership.
- Phase 0 verification plan for scaffold/build/lint/typecheck readiness.

### Out of Scope

- Feature implementation for raffle creation, order creation, proof upload, approval, notifications, or email delivery.

## Approach

Create the monorepo foundation first, then layer feature specs/design later. Keep domain constraints explicit: seller-owned records, transactional/idempotent approval, and async notification/email jobs that never roll back payment approval.

## Affected Areas

| Area                  | Impact | Description                                                   |
| --------------------- | ------ | ------------------------------------------------------------- |
| `apps/public-web`     | New    | Public raffle/purchase frontend.                              |
| `apps/admin-web`      | New    | Seller/admin operations frontend.                             |
| `apps/api`            | New    | API, transactions, jobs, Telegram/email integration boundary. |
| `packages/db`         | New    | Schema/migrations ownership and transactional approval model. |
| `packages/shared`     | New    | Types/constants: statuses, assignment modes.                  |
| `packages/validation` | New    | Zod/input contracts shared across apps/API.                   |
| `packages/config`     | New    | Environment schema and secret/config loading.                 |

## Risks

| Risk                              | Likelihood | Mitigation                                                       |
| --------------------------------- | ---------- | ---------------------------------------------------------------- |
| Over-scaffolding before specs     | Medium     | Boundaries/tooling only; no product code.                        |
| Future seller data leakage        | Medium     | Require seller-scoped models/contracts from the foundation.      |
| Double approval/number assignment | High       | Make idempotent DB transaction a core architectural requirement. |

## Decisions Needed

- Exact frontend/API generators and package naming conventions.
- DB ORM/migration tool choice.
- Job backend defaults for email and Telegram retries.
- File storage strategy for payment proofs.

## Verification Strategy

- Validate workspace installs with `pnpm install`.
- Validate Nx project graph includes all apps/packages.
- Validate lint, typecheck, and build targets exist and run.
- Validate config/validation boundaries compile without product logic.

## Rollback Plan

Revert the Phase 0 scaffold and workspace config as one change; no user data or production behavior exists yet.

## Success Criteria

- [ ] Monorepo foundation is reproducible from a clean checkout.
- [ ] Required apps/packages exist with clear ownership boundaries.
- [ ] Future specs can target manual payments, number assignment, seller isolation, notifications, jobs, and idempotent approval without restructuring.
