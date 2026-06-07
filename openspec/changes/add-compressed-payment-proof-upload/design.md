# Design: Add Compressed Payment Proof Upload

## Payload

For MVP, the endpoint accepts JSON:

```json
{
  "fileName": "proof.jpg",
  "mimeType": "image/jpeg",
  "dataBase64": "..."
}
```

This avoids multipart complexity while we are still using Node HTTP directly.

## Compression

Use `sharp` to rotate by metadata, resize to fit within 1200x1200, and encode WebP quality 45. The goal is legibility, not archival quality.

## Storage

Compressed files are stored under `packages/db/proofs`, ignored by Git. This is local-only and will be replaced by S3-compatible storage later.

## DB Update

`orders.paymentProofUrl`, `paymentProofStorageKey`, `paymentProofMimeType`, `paymentProofSizeBytes`, and `paymentProofUploadedAt` are updated. Audit action `proof_uploaded` is inserted.
