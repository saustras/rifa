# Tasks: Initialize Raffle Platform Foundation

## Phase 0: Executable Foundation Scaffold

- [x] 0.1 Capture repo baseline: verify no prior runtime code, keep `docs/prd.md` and OpenSpec artifacts intact, and record initial `git status --short --branch` output in implementation notes.

- [x] 0.2 Create monorepo root files: `package.json`, `pnpm-workspace.yaml`, `nx.json`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, and format/lint config with scripts for `lint`, `typecheck`, `format:check`, `build`, and Nx discovery.

- [x] 0.3 Scaffold deployable apps only: `apps/public-web`, `apps/admin-web`, and `apps/api` with minimal entrypoints, project configs, TypeScript configs, and placeholder health/build targets; do not add raffle UI, API endpoints, auth, or integrations.

- [x] 0.4 Scaffold shared packages: `packages/shared`, `packages/validation`, `packages/config`, and `packages/db` with package/project configs and public `src/index.ts` exports; keep `packages/db` schema/migrations as placeholders only.

- [x] 0.5 Add canonical shared constants/types in `packages/shared/src`: raffle/order/number statuses, assignment modes, roles, notification channels/types, audit actions, seller-owned/idempotency primitives, using `as const` objects plus derived TypeScript types.

- [x] 0.6 Add baseline validation/config contracts: `packages/validation/src` imports shared constants for scaffold schemas; `packages/config/src` defines typed env names for database, Redis/jobs, proof storage, Telegram, email, rate limits, and app URLs without real secrets.

- [x] 0.7 Add boundary guard configuration so web apps may import `packages/shared`, `packages/validation`, and `packages/config`, but only `apps/api` may import `packages/db`; document the expected failure for web-to-db imports.

- [x] 0.8 Add foundation docs: update/create `README.md`, `docs/architecture.md`, and `docs/verification.md` describing app/package ownership, Phase 0 non-goals, seller isolation, private proof assumptions, idempotent approval invariant, and notification jobs after commit.

- [x] 0.9 Verify clean scaffold with commands: `pnpm install`, `pnpm nx show projects` (or equivalent), `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and `pnpm build`; fix only scaffold/config issues.

- [x] 0.10 Verify spec gates manually: confirm no product feature implementation exists, required apps/packages are discoverable, shared constants drive validation contracts, and boundary checks fail loudly if a web app imports `packages/db`.

## Implementation Evidence

- Initial status after Git initialization: `## No commits yet on master` with `docs/` and `openspec/` untracked.
- Projects discovered: `validation`, `config`, `public-web`, `shared`, `admin-web`, `db`, `api`.
- Verification passed: `pnpm projects`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
- Scaffold fixes applied: removed invalid Windows ESLint `tsconfigRootDir: "."`; removed narrow app `rootDir` settings so monorepo alias imports typecheck correctly.
