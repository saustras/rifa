# Verification

## Baseline Captured

Initial status before scaffold implementation:

```txt
## No commits yet on master
?? docs/
?? openspec/
```

The initial runtime baseline contained only `docs/prd.md`, OpenSpec artifacts, and Git metadata. Product runtime code was absent.

## Commands

Run these from the repository root:

```bash
pnpm install
pnpm nx show projects
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

Database foundation commands:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Manual Spec Gates

- No product UI, API endpoint, auth flow, external-provider integration, or payment integration should exist in the foundation phases.
- Nx project discovery should list: `public-web`, `admin-web`, `api`, `shared`, `validation`, `config`, and `db`.
- Validation contracts must import status/channel/mode values from `@rifa/shared` rather than duplicating literal unions.
- Boundary safety: adding `import { DB_FOUNDATION_CONTRACT } from '@rifa/db'` to a web app should make `pnpm lint` fail with an Nx module-boundary violation.
- Drizzle migration generation should use PostgreSQL dialect with PGlite driver.
- Seed should be repeatable without duplicate baseline rows.
