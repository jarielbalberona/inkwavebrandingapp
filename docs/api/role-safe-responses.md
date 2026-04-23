# Role-Safe API Responses

Backend response shaping is mandatory for any endpoint that can expose customer, pricing, total, cost, margin, or profit data. UI hiding is not security.

## Rules

- Do not return raw database rows from role-sensitive endpoints.
- Build explicit DTOs for admin and staff using the authenticated user context.
- Use `shapeRoleAwareResponse` for admin/staff DTO selection.
- Use `assertNoStaffRestrictedKeys` in mapper tests or smoke checks for staff DTOs.
- Staff DTOs must omit restricted keys entirely. Do not return hidden values as `null`.

## Restricted Staff Fields

Staff responses must not include:

- customer contact or identity fields such as `customer_info`, `customer_name`, `customer_email`, `customer_phone`, `customer_address`, and camelCase equivalents
- `cost_price`
- `sell_price`
- `default_sell_price`
- generic pricing keys such as `price` or `pricing`
- order total keys such as `total`, `totals`, or `order_total`
- `cost`
- `margin`
- `profit`

## Orders

Order list and detail endpoints must shape responses by role.

Admin order DTOs may include customer contact fields, item pricing, order totals, cost, margin, and profit when needed by the workflow.

Staff order DTOs may include operational fields such as order id, order number, status, cup SKU, quantities, production notes, and timestamps. They must not include customer contact information, prices, totals, cost, margin, or profit.

## Reports

Admin report DTOs may include sales, cost, margin, profit, and totals.

Staff report DTOs must be operational only. If a staff report exists, it can include counts, statuses, production volume, and inventory movement summaries, but not sales totals, costs, margins, or profit.

## Mapper Pattern

```ts
const dto = shapeRoleAwareResponse(user, {
  admin: () => mapAdminOrder(row),
  staff: () => mapStaffOrder(row),
})

if (user.role === "staff") {
  assertNoStaffRestrictedKeys(dto)
}
```
