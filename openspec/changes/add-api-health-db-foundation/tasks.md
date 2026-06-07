# Tasks: Add API Health DB Foundation

- [x] 1. Use Node HTTP directly instead of NestJS for this foundation phase.
- [x] 2. Add API health router/server files.
- [x] 3. Implement `GET /api/health` without DB dependency.
- [x] 4. Implement `GET /api/health/db` with read-only `@rifa/db` query.
- [x] 5. Add API dev/serve scripts.
- [x] 6. Verify DB migration/seed still pass.
- [x] 7. Verify full gates: projects, lint, typecheck, format, build.

## Implementation Evidence

- Pivoted from NestJS to Node HTTP after runtime decorator friction with `tsx`.
- Smoke test passed:
  - `GET /api/health` -> `{ service: "rifa-api", status: "ok" }`
  - `GET /api/health/db` -> `{ ok: true, driver: "pglite", sellersCount: 1 }`
- Architecture fix: API no longer imports `drizzle-orm` directly; DB health query is exposed through `@rifa/db`.
