# Proposal: Add Public Order Creation

## Intent

Allow public buyers to create pending-review orders for active raffles.

## Scope

### In Scope

- `POST /api/public/raffles/:slug/orders`.
- Buyer/customer data validation.
- `customer_choice` mode reserves selected available numbers.
- `random` mode stores requested quantity without assigning numbers.
- Orders start as `pending_review`.

### Out of Scope

- Payment proof upload.
- Admin approval/rejection.
- Email/Telegram dispatch.
- Public order status endpoint.

## Success Criteria

- Active customer-choice raffle can create an order and reserve numbers.
- Reusing the same selected numbers fails.
- Active random raffle can create an order with quantity.
- Draft raffle cannot create orders.
