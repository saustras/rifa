# Tasks: Add Public Raffle Read API

- [x] 1. Add DB helpers for public active raffle by slug and public numbers.
- [x] 2. Add public API routes for raffle detail and numbers.
- [x] 3. Ensure draft raffles are not visible publicly.
- [x] 4. Smoke test active detail, numbers, and draft 404.
- [x] 5. Run full verification gates.

## Implementation Evidence

- Added `GET /api/public/raffles/:slug`.
- Added `GET /api/public/raffles/:slug/numbers`.
- Smoke test created an active raffle through admin API, fetched it publicly, fetched 5 public numbers, and confirmed the seeded draft raffle returns `404` publicly.
- Full gates passed: `pnpm db:migrate`, `pnpm db:seed`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
