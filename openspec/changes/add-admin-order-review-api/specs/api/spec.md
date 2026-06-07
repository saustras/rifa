# Spec: Admin Order Review API

## ADDED Requirements

### Requirement: Seller-scoped order listing

The API SHALL list orders for the authenticated seller scope.

#### Scenario: Valid admin headers

- **WHEN** `GET /api/admin/orders` is called
- **THEN** seller orders SHALL be returned.

### Requirement: Seller-scoped order detail

The API SHALL return order detail only if the order belongs to the seller scope.

#### Scenario: Order exists

- **WHEN** `GET /api/admin/orders/:id` is called for a seller-owned order
- **THEN** the response SHALL include order, customer, raffle, numbers, and proof metadata.

### Requirement: Protected proof access

Proof images SHALL only be served to authorized admin requests.

#### Scenario: Missing auth

- **WHEN** proof endpoint is requested without admin headers
- **THEN** the API SHALL return `401`.
