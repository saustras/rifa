# Spec: Admin Raffles CRUD

## ADDED Requirements

### Requirement: Temporary admin guard

Admin raffle endpoints SHALL require a valid development API key and seller header until real auth exists.

#### Scenario: Missing admin headers

- **WHEN** an admin raffle endpoint is called without headers
- **THEN** the API SHALL return `401`.

### Requirement: Seller-scoped raffle listing

The API SHALL list only raffles belonging to the provided seller scope.

#### Scenario: List raffles

- **WHEN** `GET /api/admin/raffles` is called with valid headers
- **THEN** the response SHALL contain only raffles for `x-seller-id`.

### Requirement: Raffle creation with numbers

The API SHALL create a raffle and its number pool in one logical operation.

#### Scenario: Create valid raffle

- **WHEN** `POST /api/admin/raffles` is called with valid payload
- **THEN** the DB SHALL create the raffle
- **AND** create numbers from `numberMin` through `numberMax`.

### Requirement: Raffle update

The API SHALL update safe raffle metadata fields without changing the generated number pool.

#### Scenario: Update title

- **WHEN** `PATCH /api/admin/raffles/:id` updates title
- **THEN** the seller-scoped raffle SHALL be updated.
