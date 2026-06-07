# Tasks: Add Public Order Creation

- [x] 1. Add public order Zod schema.
- [x] 2. Add DB helper for transactional public order creation.
- [x] 3. Reserve selected numbers for `customer_choice` mode.
- [x] 4. Store requested quantity for `random` mode.
- [x] 5. Add `POST /api/public/raffles/:slug/orders`.
- [x] 6. Smoke test selected-number order, duplicate conflict, random order, and draft 404.
- [x] 7. Run full gates.

## Implementation Evidence

- `customer_choice` smoke: created pending order and reserved 2 selected numbers.
- Conflict smoke: repeating the same selected numbers now returns `409`.
- `random` smoke: created pending order with requested quantity and no reserved numbers.
- Draft smoke: public order attempt on seeded draft raffle returns `404`.
- Full gates passed: `pnpm db:migrate`, `pnpm db:seed`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
