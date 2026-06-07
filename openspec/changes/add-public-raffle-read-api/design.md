# Design: Add Public Raffle Read API

## Public Exposure Rule

Public endpoints only return raffles with `status = active`. Admin preview is a later feature.

## Data Shape

`GET /api/public/raffles/:slug` returns raffle metadata needed by a public page: title, description, price, currency, numbering config, assignment mode, draw info, payment instructions, and timestamps.

`GET /api/public/raffles/:slug/numbers` returns number `id`, `number`, `displayNumber`, and `status`; it never returns customer/order data.

## DB Boundary

The API calls read helpers from `@rifa/db`; Drizzle remains inside `packages/db`.
