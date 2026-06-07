# Proposal: Add Admin Raffles CRUD

## Intent

Add the first real API surface for seller-scoped raffle management while keeping auth temporary and explicit.

## Scope

### In Scope

- Add Zod schemas for creating/updating raffles.
- Add DB functions for seller-scoped raffle list/detail/create/update.
- Generate raffle numbers when creating a raffle.
- Add temporary admin guard using `x-api-key` and `x-seller-id`.
- Add routes:
  - `GET /api/admin/raffles`
  - `GET /api/admin/raffles/:id`
  - `POST /api/admin/raffles`
  - `PATCH /api/admin/raffles/:id`

### Out of Scope

- Real login/JWT.
- Prize CRUD.
- Number range changes after creation.
- Public raffle page endpoints.
- Payment/order flow.

## Success Criteria

- Admin CRUD works against local PGlite.
- Requests require the temporary admin headers.
- Raffle creation creates the configured number rows.
- Existing gates and API smoke tests pass.
