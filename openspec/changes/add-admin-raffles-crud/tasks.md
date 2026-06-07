# Tasks: Add Admin Raffles CRUD

- [x] 1. Add validation schemas for create/update raffle payloads.
- [x] 2. Add DB raffle DTOs and seller-scoped list/detail/create/update helpers.
- [x] 3. Generate raffle number rows during create.
- [x] 4. Add temporary admin header guard in API.
- [x] 5. Add admin raffle routes to Node HTTP API.
- [x] 6. Smoke test unauthorized/list/create/detail/update.
- [x] 7. Run full verification gates.

## Implementation Evidence

- Temporary admin guard requires `x-api-key: dev-local-token` and `x-seller-id`.
- Smoke test passed:
  - missing headers returned `401`.
  - `POST /api/admin/raffles` created a raffle and generated number rows.
  - `GET /api/admin/raffles` listed seller-scoped raffles.
  - `GET /api/admin/raffles/:id` returned created raffle detail.
  - `PATCH /api/admin/raffles/:id` updated safe metadata.
- Full gates passed with sequential Nx scripts: `pnpm db:migrate`, `pnpm db:seed`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
- `package.json` now uses `--parallel=1` for lint/typecheck/build to avoid Windows/Node OOM during concurrent `tsc` runs.
