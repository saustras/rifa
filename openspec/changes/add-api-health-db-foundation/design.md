# Design: Add API Health DB Foundation

## Approach

Use Node's built-in HTTP server while keeping the implementation intentionally small. The API imports `@rifa/db` because `apps/api` is the only app allowed to cross the DB boundary.

NestJS was intentionally avoided in this phase because decorator/runtime friction slowed the foundation before product routes existed. A future migration to Fastify or another router remains possible once the API surface grows.

## Endpoints

```txt
GET /health
GET /health/db
```

`/health` reports API/runtime status.

`/health/db` opens a local PGlite Drizzle client, runs a small aggregate query against `sellers`, closes the client, and returns database readiness. If the database is not migrated, the endpoint returns `ok: false` with an error message instead of crashing the process.

## Boundaries

- `apps/api` may import `@rifa/db`.
- Web apps still cannot import DB.
- No product routes are added.
- DB side effects are limited to read-only health queries.

## Verification

- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm build`
- Optional manual run: `pnpm api:dev` then open `/health` and `/health/db`.
