# Spec: Admin Order Approve Reject

## ADDED Requirements

### Requirement: Approve pending order

The API SHALL allow a seller admin to approve a pending order with proof.

#### Scenario: Customer-choice order approved

- **WHEN** admin approves a pending customer-choice order
- **THEN** reserved numbers SHALL become assigned
- **AND** order SHALL become paid.

### Requirement: Reject pending order

The API SHALL allow a seller admin to reject a pending order.

#### Scenario: Reserved numbers rejected

- **WHEN** admin rejects a pending order with reserved numbers
- **THEN** those numbers SHALL become available again.

### Requirement: Invalid state conflict

Already processed orders SHALL NOT be approved/rejected again.

#### Scenario: Approve already paid order

- **WHEN** admin approves an already paid order
- **THEN** the API SHALL return `409`.
