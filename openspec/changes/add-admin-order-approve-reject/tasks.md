# Tasks: Add Admin Order Approve Reject

- [x] 1. Add DB helper for transactional order approval.
- [x] 2. Add DB helper for transactional order rejection.
- [x] 3. Add API routes for approve/reject.
- [x] 4. Map invalid state and missing proof to safe HTTP errors.
- [x] 5. Smoke test approve customer_choice.
- [x] 6. Smoke test approve random.
- [x] 7. Smoke test reject releases numbers.
- [x] 8. Run full gates.

## Implementation Evidence

- Added `POST /api/admin/orders/:id/approve`.
- Added `POST /api/admin/orders/:id/reject`.
- Smoke test approved customer-choice order: `paid` with 2 assigned numbers.
- Smoke test double approval returned `409`.
- Smoke test approved random order: `paid` with 3 assigned numbers.
- Smoke test rejected customer-choice order: `rejected`, detail numbers cleared, 2 numbers released to `available`.
- Full gates passed: `pnpm db:migrate`, `pnpm db:seed`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
