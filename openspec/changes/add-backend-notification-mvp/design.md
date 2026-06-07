# Design: Add Backend Notification MVP

## DB Boundary

Notification persistence stays inside `packages/db`. The API uses exported helpers only; it does not import Drizzle or table objects directly.

## Telegram Seller Notification

On successful proof upload, the API starts a fire-and-forget side effect:

1. Build an `order_pending_review` Telegram notification payload.
2. If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_SELLER_CHAT_ID` is missing or contains `change-me`, write a `failed` log and skip the provider call.
3. If configured, call Telegram `sendMessage`.
4. Persist `delivered` with provider message id or `failed` with error message.

This side effect is intentionally not awaited by the HTTP response path so proof upload remains the core operation.

## Buyer Email Notification Logs

After successful admin approve/reject responses, the API starts a fire-and-forget side effect that writes an email notification log with status `queued`. SMTP delivery is intentionally deferred.

## Idempotency

Notification logs use deterministic keys by channel, notification type, and order id. Repeated notification attempts update the existing log rather than throwing a unique constraint error.
