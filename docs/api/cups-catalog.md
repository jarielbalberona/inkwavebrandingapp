# Cups Catalog API Rules

## SKU Policy

SKU is the cup identity. Brand, size, and dimension are descriptive fields only.

Backend and frontend validation use the same MVP rules:

- Trim leading and trailing whitespace.
- Collapse internal whitespace runs to a single hyphen.
- Uppercase the SKU.
- Allow only uppercase letters, numbers, hyphens, and underscores.
- Maximum length is 80 characters.
- Store normalized SKU values only.
- Enforce case-insensitive uniqueness at the database layer.

Examples:

- ` cup 16 oz ` normalizes to `CUP-16-OZ`.
- `cup-001` normalizes to `CUP-001`.
- `Cup_001` normalizes to `CUP_001`.

## Active And Inactive Cups

Inactive cups remain in the catalog for history and references. Normal list queries return active cups by default. Admin workflows can request inactive cups with `include_inactive=true`.

Changing active state is allowed through the catalog API, but future inventory/order tickets must prevent deleting or mutating historical identity data in ways that break ledger or order references.
