# Foundation Specification

## Purpose

Define Phase 0 behavior for a reproducible raffle-platform foundation. This spec covers structure and invariants only; it MUST NOT require product UI, endpoints, migrations, auth flows, or external-provider delivery.

## Requirements

### Requirement: Monorepo initialization

The system MUST provide a clean-checkout `pnpm` + Nx workspace with install, lint, typecheck, format-check, build, and graph/discovery commands.

#### Scenario: Clean workspace validates

- GIVEN a fresh checkout
- WHEN foundation verification runs
- THEN install, lint, typecheck, format-check, build, and project discovery MUST complete or report actionable scaffold errors

#### Scenario: Product code is absent

- GIVEN Phase 0 scope
- WHEN the workspace is inspected
- THEN it MUST contain scaffolding/contracts only, not raffle features or integrations

### Requirement: App and package boundaries

The system MUST define deployable apps `public-web`, `admin-web`, `api` and packages `db`, `shared`, `validation`, `config`; web apps MUST NOT import DB internals.

#### Scenario: Legal dependency direction

- GIVEN any app import
- WHEN dependency boundaries are checked
- THEN only `api` MAY depend on `db`, and all apps MAY depend on shared contracts

### Requirement: Shared constants and types

The foundation MUST expose canonical runtime constants and derived types for raffle/order/number statuses, assignment modes, roles, notifications, and audit actions.

#### Scenario: Constants drive contracts

- GIVEN validation or UI needs a status value
- WHEN it imports a domain value
- THEN it MUST use the shared canonical export, avoiding duplicate literal unions

### Requirement: Seller isolation baseline

Every seller-owned model and contract MUST carry seller ownership, and admin/API behavior MUST derive seller scope from the authenticated actor rather than trusting client-provided seller scope.

#### Scenario: Cross-seller access is blocked

- GIVEN actor A belongs to seller A
- WHEN actor A references seller B data
- THEN the request MUST be rejected or return no data

### Requirement: Manual proof review readiness

The foundation MUST reserve contracts for private proof storage metadata, proof-required review, review outcome, rejection reason, reviewer, timestamps, and audit context.

#### Scenario: Approval requires proof

- GIVEN an order lacks proof metadata
- WHEN review approval is attempted in future behavior
- THEN the contract MUST represent this as invalid

### Requirement: Number reservation and assignment invariants

The foundation MUST encode that `customer_choice` reserves selected numbers before review, `random` assigns only on approval, and assigned numbers MUST be unique per raffle.

#### Scenario: Duplicate assignment is impossible

- GIVEN a number is already assigned
- WHEN another order attempts to receive it
- THEN the invariant MUST reject the assignment

#### Scenario: Reservation hides availability

- GIVEN a selected number is reserved
- WHEN availability is queried
- THEN it MUST NOT appear available until released or expired

### Requirement: Security baseline

The foundation MUST require typed secrets, strong input/file validation hooks, private proof access, role-aware admin access, rate-limit readiness, protected exports, and audit logging for sensitive actions.

#### Scenario: Proofs are private

- GIVEN proof metadata exists
- WHEN a notification or public response is prepared
- THEN it MUST NOT expose public proof URLs or full documents

### Requirement: Idempotency baseline

The approval contract MUST be atomic and idempotent: an order MUST NOT be approved twice, rejected orders MUST require explicit reopening, and notification failures MUST NOT roll back approval.

#### Scenario: Repeated approval is safe

- GIVEN an order is already `paid`
- WHEN approval is requested again
- THEN state and number assignments MUST remain unchanged

### Requirement: Notification job baseline

The foundation MUST define durable email/Telegram job contracts and notification logs with channel, type, recipient, status, provider id, error, and timestamps.

#### Scenario: Provider failure is logged

- GIVEN a post-commit notification job fails
- WHEN retry handling records the result
- THEN approval MUST remain committed and the error MUST be visible for operations

### Requirement: Verification scripts

The foundation MUST include scripts or documented commands proving install reproducibility, Nx project discovery, static quality, build readiness, and boundary safety.

#### Scenario: Boundary check fails loudly

- GIVEN a web app imports `db`
- WHEN verification runs
- THEN it MUST fail with a boundary violation
