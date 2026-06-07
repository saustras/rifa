# Design: Add Public Order Creation

## Flow

Public request creates/records a customer and a pending order. The raffle assignment mode controls number behavior:

- `customer_choice`: selected numbers are reserved immediately.
- `random`: only quantity is stored; assignment happens after manual payment approval.

## Consistency

The DB helper performs the order create and number reservation in a transaction. It verifies the raffle is active and number rows are still available before reserving.

## Security / Privacy

The response can include order id, status, amount, and reserved numbers. It must not expose other buyers' data.

## Future

Next phase should add proof upload and public order status.
