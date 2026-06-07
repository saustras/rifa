# Design: Add Admin Raffles CRUD

## Temporary Auth

Until real login exists, admin endpoints require:

```txt
x-api-key: API_DEV_TOKEN
x-seller-id: seller scope
```

Default local token is `dev-local-token`. This is only a development bridge and must be replaced before production.

## DB Boundary

The API imports CRUD helpers from `@rifa/db`; it does not import Drizzle directly. Seller scoping is mandatory in each DB helper.

## Number Creation

On raffle creation, the DB helper creates numbers from `numberMin` to `numberMax` with `displayNumber` padded by `numberPadding`. The request is capped at 10,000 numbers for MVP safety.

## PATCH Safety

This phase allows metadata/status/payment/draw updates only. Number range mutation is deferred because changing generated number pools safely requires sold/reserved-number policy.

## Verification

- Seed local DB.
- Smoke test POST/list/detail/PATCH with headers.
- Run lint/typecheck/format/build.
