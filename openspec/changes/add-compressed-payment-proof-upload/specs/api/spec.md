# Spec: Compressed Payment Proof Upload

## ADDED Requirements

### Requirement: Compressed proof upload

The API SHALL accept valid image proof data and store a compressed WebP version.

#### Scenario: Valid image proof

- **WHEN** a buyer uploads a valid image for an existing order
- **THEN** the API SHALL compress it to WebP
- **AND** update order proof metadata.

### Requirement: Reject invalid proof

The API SHALL reject unsupported or oversized proof payloads.

#### Scenario: Unsupported MIME type

- **WHEN** a buyer uploads a non-image proof
- **THEN** the API SHALL return validation error.

### Requirement: Local files are not committed

Compressed proof files SHALL be stored in an ignored local directory.

#### Scenario: File stored

- **WHEN** proof compression succeeds
- **THEN** the output file SHALL be under `packages/db/proofs`.
