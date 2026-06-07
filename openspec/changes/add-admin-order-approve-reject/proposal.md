# Proposal: Add Admin Order Approve Reject

## Intent

Allow admins to manually approve or reject pending-review orders after inspecting payment proof.

## Scope

### In Scope

- `POST /api/admin/orders/:id/approve`.
- `POST /api/admin/orders/:id/reject`.
- Approve `customer_choice`: reserved numbers become assigned.
- Approve `random`: available numbers are assigned.
- Reject: reserved numbers are released and order is rejected.
- Audit logs for approval/rejection.

### Out of Scope

- Email delivery.
- Telegram notification.
- Refunds.
- Reopening rejected orders.

## Success Criteria

- Approve requires pending order with proof.
- Approve is safe for both assignment modes.
- Reject releases reserved numbers.
- Invalid state returns conflict instead of server error.
