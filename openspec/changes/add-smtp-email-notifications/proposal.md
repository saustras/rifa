# Proposal: Add SMTP Email Notifications

## Why

Buyer approve/reject notifications are currently only persisted as queued logs. The backend needs real SMTP delivery readiness while preserving the invariant that notification failures never break admin review responses.

## What Changes

- Add SMTP configuration for buyer emails using `federendon26@hotmail.com` as the default sender and default SMTP user.
- Attempt SMTP delivery for buyer approve/reject notifications when SMTP config is complete and non-placeholder.
- Persist deterministic, idempotent notification logs as `delivered` or controlled `failed` outcomes.
- Keep approve/reject HTTP flows non-blocking and do not require secrets in code.

## Out of Scope

- Real SMTP secret provisioning.
- Retry workers or background queues.
- Per-seller email templates/settings.
