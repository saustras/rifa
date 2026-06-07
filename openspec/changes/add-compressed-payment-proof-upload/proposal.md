# Proposal: Add Compressed Payment Proof Upload

## Intent

Allow buyers to upload payment proof images while compressing them aggressively because they are only needed for admin visual review.

## Scope

### In Scope

- `POST /api/public/orders/:orderId/proof`.
- Accept base64 image payload for MVP.
- Validate JPEG, PNG, or WebP input.
- Compress to WebP with small dimensions/quality.
- Store compressed local file outside Git.
- Update order proof metadata.

### Out of Scope

- Multipart upload.
- Cloud/S3 storage.
- Admin proof viewing endpoint.
- OCR or payment validation.

## Success Criteria

- Upload compresses a valid image to WebP.
- Compressed file is smaller than the input smoke image.
- Order stores proof URL/key/mime/size/upload timestamp.
- Non-image payload is rejected.
