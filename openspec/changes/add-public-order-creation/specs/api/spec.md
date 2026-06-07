# Spec: Public Order Creation

## ADDED Requirements

### Requirement: Public order creation

The API SHALL allow a buyer to create a pending-review order for an active raffle.

#### Scenario: Active raffle with selected numbers

- **WHEN** a buyer submits valid data and selected numbers for a customer-choice raffle
- **THEN** an order SHALL be created with status `pending_review`
- **AND** selected numbers SHALL become reserved.

### Requirement: Number conflict protection

Selected numbers SHALL only be reserved if all requested numbers are available.

#### Scenario: Number already reserved

- **WHEN** another buyer requests an already reserved number
- **THEN** the API SHALL return conflict.

### Requirement: Draft raffle protection

Draft raffles SHALL NOT accept public orders.

#### Scenario: Draft raffle order attempt

- **WHEN** public order creation is attempted for a draft raffle
- **THEN** the API SHALL return 404.
