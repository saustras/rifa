# Spec: API Health DB Foundation

## ADDED Requirements

### Requirement: API liveness endpoint

The API SHALL expose a liveness endpoint that does not require database access.

#### Scenario: Health endpoint is called

- **WHEN** `GET /health` is requested
- **THEN** the API SHALL return an object with service name, status, and timestamp.

### Requirement: Database readiness endpoint

The API SHALL expose a database readiness endpoint that validates the local database connection using `@rifa/db`.

#### Scenario: Database is migrated

- **WHEN** `GET /health/db` is requested after migrations and seed
- **THEN** the API SHALL return `ok: true` and a seller count.

#### Scenario: Database is not migrated

- **WHEN** `GET /health/db` cannot query the database
- **THEN** the API SHALL return `ok: false` and a safe error message.

### Requirement: Scaffold boundaries remain intact

The API health foundation SHALL NOT add product CRUD, auth, payment, upload, notification, or draw-result behavior.

#### Scenario: Verification runs

- **WHEN** lint, typecheck, format, and build run
- **THEN** all existing projects SHALL pass.
