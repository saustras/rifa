# Spec: Public Raffle Read API

## ADDED Requirements

### Requirement: Public active raffle by slug

The API SHALL expose active raffle metadata by slug.

#### Scenario: Active raffle exists

- **WHEN** `GET /api/public/raffles/:slug` is called for an active raffle
- **THEN** the API SHALL return the raffle public data.

#### Scenario: Raffle is not active

- **WHEN** `GET /api/public/raffles/:slug` is called for a draft raffle
- **THEN** the API SHALL return `404`.

### Requirement: Public raffle numbers

The API SHALL expose raffle number status for public selection without exposing buyer/order data.

#### Scenario: Numbers requested

- **WHEN** `GET /api/public/raffles/:slug/numbers` is called
- **THEN** the API SHALL return number display/status data only.
