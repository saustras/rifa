# Tasks: Add Admin Order Review API

- [x] 1. Add seller-scoped order list/detail DB helpers.
- [x] 2. Include customer, raffle summary, order numbers, and proof metadata in detail.
- [x] 3. Add protected local proof file streaming endpoint.
- [x] 4. Add API routes for admin orders.
- [x] 5. Smoke test list/detail/proof and unauthorized proof.
- [x] 6. Run full gates.

## Implementation Evidence

- Added `GET /api/admin/orders`.
- Added `GET /api/admin/orders/:id`.
- Added `GET /api/admin/orders/:id/proof`.
- Smoke test created order + compressed proof, listed orders, fetched detail with 2 selected numbers, served proof as `image/webp`, and verified missing auth returns `401`.
- Full gates passed: `pnpm db:migrate`, `pnpm db:seed`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
