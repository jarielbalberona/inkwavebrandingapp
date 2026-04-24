import {
  Button,
  Link,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

import { EmailShell } from "../components/EmailShell.js"
import { StatusBadge } from "../components/StatusBadge.js"
import { formatCount } from "../lib/format.js"

export interface LowStockAlertItem {
  name: string
  sku?: string
  variant?: string
  currentStock: number
  reorderLevel: number
  status: "low" | "out"
}

export interface LowStockAlertEmailProps {
  businessName: string
  alertDateLabel: string
  inventoryUrl: string
  recipientName?: string
  note?: string
  items: LowStockAlertItem[]
}

export function LowStockAlertEmail({
  businessName,
  alertDateLabel,
  inventoryUrl,
  recipientName,
  note,
  items,
}: LowStockAlertEmailProps) {
  const outOfStockCount = items.filter((item) => item.status === "out").length
  const lowStockCount = items.length - outOfStockCount
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,"

  return (
    <EmailShell
      previewText={`${businessName} has ${items.length} stock alerts requiring action.`}
      heading="Low-stock alert"
      subheading={`${businessName} · ${alertDateLabel}`}
      eyebrow="Inventory Alert"
      helpUrl={inventoryUrl}
      footerNote="The package is ready for Resend, but notification policy still belongs in the app."
    >
      <Text className="m-0 mb-6 text-[15px] leading-7 text-foreground">
        {greeting} inventory dropped below the operating threshold. Fix the stock, or expect order
        friction.
      </Text>

      <Section className="mb-6 rounded-lg border border-border bg-muted px-5 py-4">
        <Text className="m-0 text-sm font-semibold text-foreground">Alert summary</Text>
        <Text className="m-0 mt-3 text-sm leading-7 text-muted-foreground">
          Out of stock: <strong>{formatCount(outOfStockCount)}</strong> · Low stock:{" "}
          <strong>{formatCount(lowStockCount)}</strong>
        </Text>
      </Section>

      <Section className="mb-6 rounded-lg border border-border px-5 py-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Item
              </th>
              <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Details
              </th>
              <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                On hand
              </th>
              <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Reorder
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.name}-${item.sku ?? item.variant ?? item.currentStock}`} className="border-b border-border">
                <td className="py-3 text-sm font-medium text-foreground">
                  {item.name}
                  <div className="mt-2">
                    <StatusBadge
                      label={item.status === "out" ? "Out of stock" : "Low stock"}
                      tone={item.status === "out" ? "critical" : "warning"}
                    />
                  </div>
                </td>
                <td className="py-3 text-sm leading-6 text-muted-foreground">
                  {item.sku ? <div>SKU: {item.sku}</div> : null}
                  {item.variant ? <div>{item.variant}</div> : null}
                  {!item.sku && !item.variant ? "No additional item detail." : null}
                </td>
                <td className="py-3 text-right text-sm text-foreground">{formatCount(item.currentStock)}</td>
                <td className="py-3 text-right text-sm text-muted-foreground">
                  {formatCount(item.reorderLevel)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {note ? (
        <Section className="mb-6 rounded-lg border border-border bg-muted px-5 py-4">
          <Text className="m-0 text-sm font-semibold text-foreground">Operator note</Text>
          <Text className="m-0 mt-3 text-sm leading-7 text-muted-foreground">{note}</Text>
        </Section>
      ) : null}

      <Section className="text-center">
        <Button className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground no-underline" href={inventoryUrl}>
          Review inventory
        </Button>
        <Text className="m-0 mt-4 text-xs leading-6 text-muted-foreground">
          <Link className="text-primary no-underline" href={inventoryUrl}>
            {inventoryUrl}
          </Link>
        </Text>
      </Section>
    </EmailShell>
  )
}
