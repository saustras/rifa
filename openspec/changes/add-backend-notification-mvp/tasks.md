# Tasks: Add Backend Notification MVP

- [x] 1. Add DB helper for idempotent notification log persistence.
- [x] 2. Wire Telegram seller notification on proof upload with config validation.
- [x] 3. Wire queued buyer email logs on admin approve/reject.
- [x] 4. Ensure notification side effects do not fail proof upload or review responses.
- [x] 5. Run verification gates.

## Implementation Evidence

- Added `upsertNotificationLog` in `packages/db` using deterministic idempotency keys.
- Proof upload starts Telegram notification side effect after returning success response.
- Approve/reject start queued buyer email log side effects after returning success response.
- Missing/placeholder Telegram config creates a controlled `failed` log instead of calling Telegram.
- Verification passed: `pnpm db:migrate`, `pnpm db:seed`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
