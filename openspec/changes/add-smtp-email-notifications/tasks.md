# Tasks: Add SMTP Email Notifications

- [x] 1. Add SMTP/Nodemailer dependency and environment configuration defaults.
- [x] 2. Implement Spanish approve/reject buyer email content with text and minimal HTML.
- [x] 3. Replace queued-only buyer email logs with non-blocking SMTP delivery attempts and deterministic idempotent log updates.
- [x] 4. Persist controlled `failed` email logs when SMTP config is missing or placeholder.
- [x] 5. Run install, verification gates, and no-secret smoke for approve/reject.
