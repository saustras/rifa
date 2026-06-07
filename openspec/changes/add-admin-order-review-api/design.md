# Design: Add Admin Order Review API

## Endpoints

```txt
GET /api/admin/orders
GET /api/admin/orders/:id
GET /api/admin/orders/:id/proof
```

All endpoints use the existing temporary admin guard (`x-api-key`, `x-seller-id`).

## Detail Shape

Order detail includes order fields, customer data, raffle summary, selected/reserved numbers, and proof metadata. It does not inline image bytes.

## Proof Access

Proof files are served only through admin-authenticated endpoint. The storage key must come from the seller-scoped order row, not request input, to avoid path traversal.

## Future

This enables the admin review sheet. The next step is approve/reject behavior.
