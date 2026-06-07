# Proposal: Add API Health DB Foundation

## Intent

Turn `apps/api` from a placeholder into a minimal Node HTTP API that can boot locally and verify the Drizzle/PGlite database foundation.

## Scope

### In Scope

- Use Node's built-in HTTP server; no decorator-based framework in this phase.
- Add a small typed router for health endpoints.
- Expose `GET /health` for API liveness.
- Expose `GET /health/db` for database readiness using `@rifa/db`.
- Add an API serve/dev target and root script.
- Keep seller/auth/raffle CRUD out of this phase.

### Out of Scope

- Auth/session implementation.
- Raffle CRUD.
- Order approval/rejection transactions.
- Telegram/email jobs.
- File uploads.

## Success Criteria

- API builds as an Nx project.
- `/health` returns static API status.
- `/health/db` can query local PGlite after migrations/seed.
- Existing gates pass: database commands, lint, typecheck, format, build.
