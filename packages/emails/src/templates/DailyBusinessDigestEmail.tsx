import {
  Button,
  Column,
  Link,
  Row,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

import { EmailShell } from "../components/EmailShell.js"
import { MetricCard } from "../components/MetricCard.js"
import { StatusBadge } from "../components/StatusBadge.js"
import { formatCount, formatCurrency } from "../lib/format.js"

export interface DailyBusinessDigestEmailProps {
  businessName: string
  reportDateLabel: string
  dashboardUrl: string
  recipientName?: string
  currency?: string
  locale?: string
  orderSummary: {
    totalOrders: number
    pendingOrders: number
    inProgressOrders: number
    partialReleasedOrders: number
    completedOrders: number
    canceledOrders: number
  }
  invoiceSummary: {
    pendingInvoiceCount: number
    paidInvoiceCount: number
    voidInvoiceCount: number
    totalPaidAmount: number
    outstandingBalance: number
  }
  inventorySummary: {
    lowStockCount: number
    outOfStockCount: number
    highlightedItems: Array<{
      name: string
      onHand: number
      reorderLevel: number
    }>
  }
  inventoryActivitySummary?: {
    stockIntakeCount: number
    adjustmentCount: number
  }
  highlights?: string[]
}

export function DailyBusinessDigestEmail({
  businessName,
  reportDateLabel,
  dashboardUrl,
  recipientName,
  currency = "PHP",
  locale = "en-PH",
  orderSummary,
  invoiceSummary,
  inventorySummary,
  inventoryActivitySummary,
  highlights = [],
}: DailyBusinessDigestEmailProps) {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,"
  const inventoryTone =
    inventorySummary.outOfStockCount > 0 ? "critical" : "default"
  const invoiceTone =
    invoiceSummary.pendingInvoiceCount > 0 || invoiceSummary.outstandingBalance > 0
      ? "warning"
      : "positive"
  const invoiceStatusLabel =
    invoiceSummary.pendingInvoiceCount > 0
      ? `${invoiceSummary.pendingInvoiceCount} pending`
      : "Collected"

  return (
    <EmailShell
      previewText={`${businessName} digest: ${orderSummary.pendingOrders} pending orders, ${invoiceSummary.pendingInvoiceCount} pending invoices.`}
      heading="Daily business digest"
      subheading={`${businessName} · ${reportDateLabel}`}
      eyebrow="Daily Operations"
      helpUrl={dashboardUrl}
    >
      <Text className="m-0 mb-6 text-[15px] leading-7 text-foreground">
        {greeting} Here is the current operating picture for the business. This email is meant to
        reduce dashboard hunting, not replace the dashboard.
      </Text>

      <Row className="mb-4">
        <Column className="w-1/3 pr-2">
          <MetricCard label="Pending Orders" value={formatCount(orderSummary.pendingOrders)} />
        </Column>
        <Column className="w-1/3 px-1">
          <MetricCard
            label="Outstanding Balance"
            value={formatCurrency(invoiceSummary.outstandingBalance, currency, locale)}
          />
        </Column>
        <Column className="w-1/3 pl-2">
          <MetricCard
            label="Stock Alerts"
            tone={inventoryTone}
            value={formatCount(
              inventorySummary.lowStockCount + inventorySummary.outOfStockCount,
            )}
          />
        </Column>
      </Row>

      <Section className="mb-6 rounded-lg border border-border bg-muted px-5 py-4">
        <Text className="m-0 text-sm font-semibold text-foreground">Order flow</Text>
        <Text className="m-0 mt-3 text-sm leading-7 text-muted-foreground">
          Total orders: <strong>{formatCount(orderSummary.totalOrders)}</strong> · In progress:{" "}
          <strong>{formatCount(orderSummary.inProgressOrders)}</strong> · Partial released:{" "}
          <strong>{formatCount(orderSummary.partialReleasedOrders)}</strong> · Completed:{" "}
          <strong>{formatCount(orderSummary.completedOrders)}</strong> · Canceled:{" "}
          <strong>{formatCount(orderSummary.canceledOrders)}</strong>
        </Text>
      </Section>

      <Section className="mb-6 rounded-lg border border-border px-5 py-4">
        <Row>
          <Column className="w-1/2">
            <Text className="m-0 text-sm font-semibold text-foreground">Invoice watch</Text>
          </Column>
          <Column className="w-1/2 text-right">
            <StatusBadge
              label={invoiceStatusLabel}
              tone={invoiceTone}
            />
          </Column>
        </Row>
        <Text className="m-0 mt-3 text-sm leading-7 text-muted-foreground">
          Paid invoices: <strong>{formatCount(invoiceSummary.paidInvoiceCount)}</strong> · Void
          invoices: <strong>{formatCount(invoiceSummary.voidInvoiceCount)}</strong> · Amount
          collected:{" "}
          <strong>{formatCurrency(invoiceSummary.totalPaidAmount, currency, locale)}</strong>
        </Text>
      </Section>

      <Section className="mb-6 rounded-lg border border-border px-5 py-4">
        <Row>
          <Column className="w-1/2">
            <Text className="m-0 text-sm font-semibold text-foreground">Inventory watch</Text>
          </Column>
          <Column className="w-1/2 text-right">
            <StatusBadge
              label={
                inventorySummary.outOfStockCount > 0
                  ? `${inventorySummary.outOfStockCount} out`
                  : `${inventorySummary.lowStockCount} low`
              }
              tone={inventorySummary.outOfStockCount > 0 ? "critical" : "warning"}
            />
          </Column>
        </Row>

        {inventorySummary.highlightedItems.length > 0 ? (
          <table className="mt-4 w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Item
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
              {inventorySummary.highlightedItems.map((item) => (
                <tr key={item.name} className="border-b border-border">
                  <td className="py-3 text-sm text-foreground">{item.name}</td>
                  <td className="py-3 text-right text-sm text-foreground">{formatCount(item.onHand)}</td>
                  <td className="py-3 text-right text-sm text-muted-foreground">
                    {formatCount(item.reorderLevel)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Text className="m-0 mt-3 text-sm leading-7 text-muted-foreground">
            No highlighted items in this digest.
          </Text>
        )}
      </Section>

      {inventoryActivitySummary ? (
        <Section className="mb-6 rounded-lg border border-border bg-muted px-5 py-4">
          <Text className="m-0 text-sm font-semibold text-foreground">Inventory activity</Text>
          <Text className="m-0 mt-3 text-sm leading-7 text-muted-foreground">
            Stock intake events:{" "}
            <strong>{formatCount(inventoryActivitySummary.stockIntakeCount)}</strong> ·
            Adjustments: <strong>{formatCount(inventoryActivitySummary.adjustmentCount)}</strong>
          </Text>
        </Section>
      ) : null}

      {highlights.length > 0 ? (
        <Section className="mb-6 rounded-lg border border-border bg-muted px-5 py-4">
          <Text className="m-0 text-sm font-semibold text-foreground">Notes for today</Text>
          <ul className="mb-0 mt-3 pl-5">
            {highlights.map((highlight) => (
              <li key={highlight} className="mb-2 text-sm leading-7 text-muted-foreground">
                {highlight}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section className="text-center">
        <Button className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground no-underline" href={dashboardUrl}>
          Open dashboard
        </Button>
        <Text className="m-0 mt-4 text-xs leading-6 text-muted-foreground">
          If email is the wrong channel for this, stop and fix notification routing in the app. Do
          not pile on more templates.
        </Text>
        <Text className="m-0 mt-2 text-xs text-muted-foreground">
          <Link className="text-primary no-underline" href={dashboardUrl}>
            {dashboardUrl}
          </Link>
        </Text>
      </Section>
    </EmailShell>
  )
}
