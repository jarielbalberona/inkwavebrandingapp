import {
  defaultEmailBranding,
  type DailyBusinessDigestEmailProps,
} from "@workspace/emails"

import type {
  DailyDigestActivityCounts,
  DailyDigestAggregationDataSource,
  DailyDigestFulfillmentDaySummary,
  DailyDigestFulfillmentStage,
  DailyDigestInvoiceSnapshot,
  DailyDigestOrderStatusCounts,
} from "./daily-digest-aggregation.repository.js"
import {
  formatManilaBusinessDateLabel,
  getManilaBusinessWindow,
  type DailyDigestBusinessWindow,
} from "./daily-digest-time.js"

export interface DailyDigestBuildOptions {
  businessDate: string
  dashboardUrl: string
}

export interface DailyDigestBuildResult {
  window: DailyDigestBusinessWindow
  props: DailyBusinessDigestEmailProps
  highlights: string[]
  isEmpty: boolean
}

export class DailyDigestAggregationService {
  constructor(private readonly repository: DailyDigestAggregationDataSource) {}

  async build(options: DailyDigestBuildOptions): Promise<DailyDigestBuildResult> {
    const window = getManilaBusinessWindow(options.businessDate)
    const [orderStatusCounts, invoiceSnapshot, activity, fulfillmentDay, lowStockItems] =
      await Promise.all([
        this.repository.getOrderStatusCounts(),
        this.repository.getInvoiceSnapshot(),
        this.repository.getActivityCounts(window),
        this.repository.getFulfillmentDaySummary(window),
        this.repository.listLowStockItems(),
      ])

    const highlights = buildHighlights(activity, invoiceSnapshot, fulfillmentDay)
    const lowStockCount = lowStockItems.filter((item) => item.status === "low").length
    const outOfStockCount = lowStockItems.filter((item) => item.status === "out").length

    const props: DailyBusinessDigestEmailProps = {
      businessName: defaultEmailBranding.companyName,
      reportDateLabel: formatManilaBusinessDateLabel(options.businessDate),
      dashboardUrl: options.dashboardUrl,
      orderSummary: {
        totalOrders: totalOrders(orderStatusCounts),
        pendingOrders: orderStatusCounts.pending,
        inProgressOrders: orderStatusCounts.inProgress,
        partialReleasedOrders: orderStatusCounts.partialReleased,
        completedOrders: orderStatusCounts.completed,
        canceledOrders: orderStatusCounts.canceled,
      },
      invoiceSummary: {
        pendingInvoiceCount: invoiceSnapshot.pendingCount,
        paidInvoiceCount: invoiceSnapshot.paidCount,
        voidInvoiceCount: invoiceSnapshot.voidCount,
        totalPaidAmount: safeFiniteNumber(activity.totalPaidAmount),
        outstandingBalance: safeFiniteNumber(invoiceSnapshot.outstandingBalance),
      },
      inventorySummary: {
        lowStockCount,
        outOfStockCount,
        highlightedItems: lowStockItems.map((item) => ({
          name: item.name,
          onHand: item.onHand,
          reorderLevel: item.reorderLevel,
        })),
      },
      inventoryActivitySummary: {
        stockIntakeCount: activity.stockIntakeCount,
        adjustmentCount: activity.adjustmentCount,
      },
      fulfillmentDay: mapFulfillmentDayForEmail(fulfillmentDay),
      highlights,
    }

    const isEmpty =
      highlights.length === 0 &&
      props.inventorySummary.highlightedItems.length === 0 &&
      props.orderSummary.totalOrders === 0 &&
      props.invoiceSummary.pendingInvoiceCount === 0 &&
      props.invoiceSummary.paidInvoiceCount === 0 &&
      props.invoiceSummary.voidInvoiceCount === 0 &&
      fulfillmentDay.totalEvents === 0

    return {
      window,
      props,
      highlights,
      isEmpty,
    }
  }
}

function safeFiniteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

const FULFILLMENT_STAGE_LABEL: Record<DailyDigestFulfillmentStage, string> = {
  printed: "Printed",
  qa_passed: "QA passed",
  packed: "Packed",
  ready_for_release: "Ready for release",
  released: "Released",
}

function mapFulfillmentDayForEmail(
  summary: DailyDigestFulfillmentDaySummary,
): DailyBusinessDigestEmailProps["fulfillmentDay"] {
  if (summary.totalEvents === 0) {
    return undefined
  }

  return {
    totalEvents: summary.totalEvents,
    totalUnits: summary.totalUnits,
    unitsByStage: summary.unitsByStage,
    recent: summary.recent.map((row) => ({
      orderNumber: row.orderNumber,
      lineLabel: truncateForDigestLine(row.lineLabel, 80),
      stageLabel: FULFILLMENT_STAGE_LABEL[row.stage],
      quantity: row.quantity,
    })),
  }
}

function truncateForDigestLine(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) {
    return t
  }

  return `${t.slice(0, max - 1)}…`
}

function totalOrders(counts: DailyDigestOrderStatusCounts): number {
  return (
    counts.pending +
    counts.inProgress +
    counts.partialReleased +
    counts.completed +
    counts.canceled
  )
}

function buildHighlights(
  activity: DailyDigestActivityCounts,
  invoiceSnapshot: DailyDigestInvoiceSnapshot,
  fulfillment: DailyDigestFulfillmentDaySummary,
): string[] {
  const highlights: string[] = []

  if (fulfillment.totalEvents > 0) {
    highlights.push(
      `Fulfillment progress today: ${fulfillment.totalEvents} events · ${fulfillment.totalUnits} units (see stages and latest line items below).`,
    )
  }

  if (activity.ordersCreated > 0) {
    highlights.push(`Orders created today: ${activity.ordersCreated}`)
  }

  if (activity.ordersUpdated > 0) {
    highlights.push(`Orders updated today: ${activity.ordersUpdated}`)
  }

  if (activity.invoicesCreated > 0) {
    highlights.push(`Invoices created today: ${activity.invoicesCreated}`)
  }

  if (activity.paymentsRecorded > 0) {
    const totalPaid = activity.totalPaidAmount
    const totalLabel = Number.isFinite(totalPaid) ? totalPaid.toFixed(2) : "0.00"
    highlights.push(
      `Payments recorded today: ${activity.paymentsRecorded} totaling ${totalLabel}`,
    )
  }

  if (activity.invoicesVoided > 0) {
    highlights.push(`Invoices voided today: ${activity.invoicesVoided}`)
  }

  if (invoiceSnapshot.pendingCount > 0) {
    highlights.push(`Invoices still pending: ${invoiceSnapshot.pendingCount}`)
  }

  return highlights
}
