# Carry-Over And Backorder Handling

## Decision

Carry-over/backorder behavior is intentionally deferred from the MVP.

The current MVP keeps unreleased quantity on the original order line item as
`remaining_balance = ordered_quantity - total_released`. The system must not
silently move remaining quantities into a new order, adjust another order, or
create a backorder without an explicit link and audit trail.

## Current MVP Behavior

- Order creation reserves the full ordered quantity.
- Printed progress events consume reserved stock incrementally.
- Released progress events mark customer handoff quantity.
- Remaining quantity stays on the same order line item.
- Canceling an order releases only unconsumed reserved quantity.
- Completed means all line items have released quantity equal to ordered quantity.
- Partial release means some quantity has been released, but at least one line item still has remaining balance.

## Future Workflow Requirements

A future carry-over/backorder implementation must define:

- When remaining balance stays on the same order.
- When remaining balance becomes a new linked order or backorder.
- What links the original order line item to follow-up work.
- Whether reservation is preserved, released, or transferred.
- How reporting prevents duplicate released quantity, duplicate revenue, and duplicate cup usage.
- How cancellation behaves after a partial release.

## Required Data Model Direction

If implemented later, use explicit linkage rather than implicit quantity movement.

Likely model direction:

- `order_line_item_carry_overs`
- `source_order_line_item_id`
- `target_order_id` or `target_order_line_item_id`
- `quantity`
- `reason`
- `created_by`
- `created_at`

Do not implement this with a loose note field or by copying line items without
linkage. That destroys traceability.

## Inventory Rules For Future Work

A future workflow must be explicit about inventory reservation ownership:

- Preserved reservation: remaining reserved stock stays attached to the original order until the linked follow-up is created.
- Released reservation: remaining unconsumed reserved stock is released, and any follow-up order must reserve stock again.
- Transferred reservation: requires a ledgered transfer model, not blind movement edits.

The MVP does not transfer reservations.

## Reporting Rules For Future Work

Reports must avoid double-counting:

- Cup usage comes from `consume` movements, not from order quantities.
- Released quantity comes from `released` progress events.
- Revenue/cost reporting should use an explicit release basis unless a future business rule says otherwise.
- A carry-over/backorder link must not duplicate the same released quantity across two orders.

## Out Of Scope For MVP

- Creating carry-over orders automatically.
- Backorder creation UI.
- Reservation transfer ledger.
- Refunds, returns, or restocking printed goods.
- Billing/invoicing behavior.
