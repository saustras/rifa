# Proposal: Add Backend Notification MVP

## Why

The backend needs notification records for seller review and buyer order outcome events, but notification failures must never break proof upload or admin approval/rejection.

## What Changes

- Add DB package helpers for `notification_logs` so API code does not import Drizzle directly.
- Send/log a Telegram seller notification when a buyer uploads a payment proof.
- Queue buyer email notification logs when an admin approves or rejects an order.
- Treat missing or placeholder notification config as controlled failed logs instead of runtime failures.

## Out of Scope

- Real SMTP/email provider integration.
- Notification retry workers.
- Per-seller Telegram chat configuration UI.
