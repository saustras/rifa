# Proposal: Add Admin Order Review API

## Intent

Expose admin endpoints to list pending orders, inspect order details, and access compressed payment proof images securely.

## Scope

### In Scope

- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `GET /api/admin/orders/:id/proof`
- Seller-scoped access using temporary admin headers.
- Proof file streaming from local storage only for authenticated admin requests.

### Out of Scope

- Approve/reject order actions.
- Email/Telegram notifications.
- Public proof access.
- UI sheet implementation.

## Success Criteria

- Admin can list seller-scoped orders.
- Admin can fetch order detail with customer, raffle, and selected numbers.
- Proof endpoint returns WebP only with valid admin headers.
- Missing auth returns 401.
