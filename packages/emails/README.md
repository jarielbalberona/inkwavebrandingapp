# @workspace/emails

Shared React Email package for Ink Wave.

## What this package owns

- shared email theme tokens
- shared layout and header/footer shell
- reusable starter templates
- render helpers for HTML/text generation

## What this package does not own

- Resend credentials
- email delivery policies
- notification scheduling
- business-specific recipient lookup

Those belong in the app runtime.

## Commands

```bash
pnpm -C packages/emails build
pnpm -C packages/emails test
pnpm -C packages/emails render DailyBusinessDigestEmail
pnpm -C packages/emails render LowStockAlertEmail
```

## App usage

```ts
import { renderDailyBusinessDigestEmail } from "@workspace/emails/server"

const rendered = await renderDailyBusinessDigestEmail({
  businessName: "Ink Wave Packaging",
  reportDateLabel: "April 25, 2026",
  dashboardUrl: "https://app.example.com/dashboard",
  orderSummary: {
    totalOrders: 48,
    pendingOrders: 11,
    inProgressOrders: 9,
    partialReleasedOrders: 4,
    completedOrders: 18,
    canceledOrders: 6,
  },
  invoiceSummary: {
    pendingInvoiceCount: 8,
    paidInvoiceCount: 16,
    voidInvoiceCount: 1,
    totalPaidAmount: 240000,
    outstandingBalance: 128500,
  },
  inventorySummary: {
    lowStockCount: 4,
    outOfStockCount: 1,
    highlightedItems: [{ name: "95mm Flat Lid", onHand: 0, reorderLevel: 300 }],
  },
  inventoryActivitySummary: {
    stockIntakeCount: 3,
    adjustmentCount: 2,
  },
})
```
