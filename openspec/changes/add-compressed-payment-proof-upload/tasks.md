# Tasks: Add Compressed Payment Proof Upload

- [x] 1. Add `sharp` dependency to API.
- [x] 2. Add proof storage ignore/docs/config.
- [x] 3. Add Zod schema for base64 image proof payload.
- [x] 4. Add DB helper to attach proof metadata to order.
- [x] 5. Add API route `POST /api/public/orders/:orderId/proof`.
- [x] 6. Compress proof to WebP max 1200px quality 45.
- [x] 7. Smoke test valid compression and invalid MIME rejection.
- [x] 8. Run full gates.

## Implementation Evidence

- Smoke proof upload compressed a generated PNG from `18255` bytes to WebP `11420` bytes.
- Response stored `mimeType=image/webp`, compressed size, proof URL and storage key.
- Invalid MIME upload returned `400`.
- Full gates passed: `pnpm db:migrate`, `pnpm db:seed`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
