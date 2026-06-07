# Proposal: Add Public Raffle Read API

## Intent

Expose read-only public raffle endpoints needed by the future buyer-facing page.

## Scope

### In Scope

- `GET /api/public/raffles/:slug`
- `GET /api/public/raffles/:slug/numbers`
- Return only active raffle details publicly.
- Return number availability summary/list without exposing buyer data.

### Out of Scope

- Public order creation.
- Payment proof upload.
- Customer data.
- Admin-only fields beyond public raffle configuration.

## Success Criteria

- Active raffle can be retrieved by slug.
- Draft/non-active raffle returns 404 publicly.
- Numbers endpoint returns status/display data only.
- Full gates and smoke tests pass.
