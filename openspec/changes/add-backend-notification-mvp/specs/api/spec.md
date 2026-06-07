# Spec: Backend Notification MVP

## ADDED Requirements

### Requirement: Seller Telegram proof notification is non-blocking

The API SHALL attempt a seller Telegram notification when a buyer uploads a payment proof.

#### Scenario: Telegram config missing

- **WHEN** proof upload succeeds and Telegram config is missing or placeholder
- **THEN** the API SHALL still return proof upload success
- **AND** a notification log SHALL be written with failure/skip details.

#### Scenario: Telegram provider fails

- **WHEN** Telegram delivery fails
- **THEN** the API SHALL still keep the proof upload successful
- **AND** the notification failure SHALL be logged.

### Requirement: Buyer email logs are queued on review outcome

The API SHALL queue buyer email notification logs when an admin approves or rejects an order.

#### Scenario: Order approved

- **WHEN** admin approval succeeds
- **THEN** an `email` notification log of type `order_approved` SHALL be queued for the buyer.

#### Scenario: Order rejected

- **WHEN** admin rejection succeeds
- **THEN** an `email` notification log of type `order_rejected` SHALL be queued for the buyer.

### Requirement: Notification failure does not fail core order operations

Notification persistence or provider errors SHALL NOT change successful proof upload, approve, or reject responses into failures.
