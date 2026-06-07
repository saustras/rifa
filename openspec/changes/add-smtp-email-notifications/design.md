# Design: Add SMTP Email Notifications

## Runtime Configuration

The API reads SMTP settings from environment variables:

- `EMAIL_FROM` defaults to `federendon26@hotmail.com`.
- `SMTP_USER` defaults to `federendon26@hotmail.com`.
- `SMTP_HOST` defaults to `smtp-mail.outlook.com`.
- `SMTP_PORT` defaults to `587`.
- `SMTP_SECURE` defaults to `false` for STARTTLS on port 587.
- `SMTP_PASSWORD` has no runtime secret default and must be configured outside source control.

Missing, empty, or `change-me` secrets are treated as unconfigured.

## Delivery Flow

After admin approve/reject returns `200`, the API starts a fire-and-forget email side effect:

1. Build Spanish plain text and minimal HTML content.
2. Use deterministic idempotency key `email:<type>:<orderId>`.
3. If SMTP configuration is incomplete, upsert a `failed` notification log with a clear skip reason.
4. If SMTP is complete, upsert `processing`, send with Nodemailer, then upsert `delivered` with `providerMessageId` and `sentAt`.
5. If SMTP sending fails, catch the error and upsert `failed` without affecting the admin HTTP response.

## Non-Blocking Guarantee

The notification side effect remains outside the awaited approve/reject response path. Even provider or notification-log failures are caught and logged to stderr at most.
