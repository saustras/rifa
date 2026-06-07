# Spec: SMTP Email Notifications

## ADDED Requirements

### Requirement: Buyer approve/reject emails use SMTP when configured

The API SHALL attempt SMTP delivery for buyer order outcome notifications after admin approve/reject succeeds and SMTP configuration is complete.

#### Scenario: Approved order email is delivered

- **GIVEN** SMTP host, port, user, password, and sender are configured with non-placeholder values
- **WHEN** an admin approves an order
- **THEN** the API SHALL send a Spanish approval email to the buyer
- **AND** upsert the notification log with status `delivered`, provider message id when available, and `sentAt`.

#### Scenario: Rejected order email is delivered

- **GIVEN** SMTP host, port, user, password, and sender are configured with non-placeholder values
- **WHEN** an admin rejects an order with an optional reason
- **THEN** the API SHALL send a Spanish rejection email to the buyer
- **AND** include the rejection reason when present.

### Requirement: Missing SMTP config creates controlled failed logs

The API SHALL NOT silently keep buyer email notifications queued when SMTP config is missing or placeholder.

#### Scenario: SMTP password is placeholder

- **WHEN** admin approve/reject succeeds and `SMTP_PASSWORD` is missing or `change-me`
- **THEN** the API SHALL still return the successful admin response
- **AND** upsert an email notification log with status `failed` and a clear configuration error message.

### Requirement: Email notification side effects are idempotent and non-blocking

Buyer email notifications SHALL use deterministic idempotency key `email:<type>:<orderId>` and SHALL NOT fail approve/reject HTTP responses when persistence or SMTP delivery fails.
