# Design: Add Admin Order Approve Reject

## Approval

Approval runs in a DB transaction:

1. Load seller-scoped order and raffle.
2. Require `pending_review`.
3. Require proof metadata.
4. For `customer_choice`, update reserved raffle/order numbers to assigned.
5. For `random`, choose available numbers, mark assigned, and create order number rows.
6. Mark order paid and write audit log.

## Rejection

Rejection runs in a DB transaction:

1. Load seller-scoped pending order.
2. Release reserved raffle numbers.
3. Delete reserved `order_numbers` rows so released numbers can be reused.
4. Mark order rejected with reason.
5. Write audit log.

Deleting reserved order-number rows is intentional because `order_numbers` is reserved for final participation evidence after approval.
