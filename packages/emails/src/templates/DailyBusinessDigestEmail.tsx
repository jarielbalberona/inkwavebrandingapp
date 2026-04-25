import { Button, Column, Row, Section, Text } from "@react-email/components"

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
  /** Line-item fulfillment (printed → released) recorded on the digest business day */
  fulfillmentDay?: {
    totalEvents: number
    totalUnits: number
    unitsByStage: {
      printed: number
      qaPassed: number
      packed: number
      readyForRelease: number
      released: number
    }
    recent: Array<{
      orderNumber: string
      lineLabel: string
      stageLabel: string
      quantity: number
    }>
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
  fulfillmentDay,
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
        {greeting} Here is the current operating picture for the business.
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

      {fulfillmentDay ? (
        <Section className="mb-6 rounded-lg border border-border px-5 py-4">
          <Text className="m-0 text-sm font-semibold text-foreground">Fulfillment (today)</Text>
          <Text className="m-0 mt-3 text-sm leading-7 text-muted-foreground">
            <strong>{formatCount(fulfillmentDay.totalEvents)}</strong> progress events ·{" "}
            <strong>{formatCount(fulfillmentDay.totalUnits)}</strong> units across stages: Printed{" "}
            {formatCount(fulfillmentDay.unitsByStage.printed)} · QA{" "}
            {formatCount(fulfillmentDay.unitsByStage.qaPassed)} · Packed{" "}
            {formatCount(fulfillmentDay.unitsByStage.packed)} · Ready to release{" "}
            {formatCount(fulfillmentDay.unitsByStage.readyForRelease)} · Released{" "}
            {formatCount(fulfillmentDay.unitsByStage.released)}
          </Text>
          {fulfillmentDay.recent.length > 0 ? (
            <table className="mt-4 w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Order
                  </th>
                  <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Line
                  </th>
                  <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Stage
                  </th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Qty
                  </th>
                </tr>
              </thead>
              <tbody>
                {fulfillmentDay.recent.map((row, index) => (
                  <tr
                    key={`fulfillment-${row.orderNumber}-${index}`}
                    className="border-b border-border"
                  >
                    <td className="whitespace-nowrap py-3 text-sm text-foreground">{row.orderNumber}</td>
                    <td className="max-w-[220px] py-3 text-sm text-foreground [word-break:break-word]">
                      {row.lineLabel}
                    </td>
                    <td className="whitespace-nowrap py-3 text-sm text-muted-foreground">
                      {row.stageLabel}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right text-sm text-foreground">
                      {formatCount(row.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Section>
      ) : null}

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
      </Section>
    </EmailShell>
  )
}
