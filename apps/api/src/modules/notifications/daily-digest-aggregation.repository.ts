import { and, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  invoicePayments,
  invoices,
  inventoryMovements,
  orderItems,
  orderLineItemProgressEvents,
  orders,
} from "../../db/schema/index.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"

export interface DailyDigestAggregationWindow {
  startedAt: Date
  endedAt: Date
}

export interface DailyDigestOrderStatusCounts {
  pending: number
  inProgress: number
  partialReleased: number
  completed: number
  canceled: number
}

export interface DailyDigestInvoiceSnapshot {
  pendingCount: number
  paidCount: number
  voidCount: number
  outstandingBalance: number
}

export interface DailyDigestActivityCounts {
  ordersCreated: number
  ordersUpdated: number
  invoicesCreated: number
  invoicesVoided: number
  paymentsRecorded: number
  totalPaidAmount: number
  stockIntakeCount: number
  adjustmentCount: number
}

export type DailyDigestFulfillmentStage = (typeof orderLineItemProgressEvents.$inferSelect)["stage"]

export interface DailyDigestFulfillmentRecentRow {
  orderNumber: string
  lineLabel: string
  stage: DailyDigestFulfillmentStage
  quantity: number
}

export interface DailyDigestFulfillmentDaySummary {
  totalEvents: number
  totalUnits: number
  unitsByStage: {
    printed: number
    qaPassed: number
    packed: number
    readyForRelease: number
    released: number
  }
  /** Newest first, capped for email size */
  recent: DailyDigestFulfillmentRecentRow[]
}

export interface DailyDigestLowStockItem {
  name: string
  onHand: number
  reorderLevel: number
  status: "low" | "out"
}

export interface DailyDigestAggregationDataSource {
  getOrderStatusCounts(): Promise<DailyDigestOrderStatusCounts>
  getInvoiceSnapshot(): Promise<DailyDigestInvoiceSnapshot>
  getActivityCounts(window: DailyDigestAggregationWindow): Promise<DailyDigestActivityCounts>
  getFulfillmentDaySummary(window: DailyDigestAggregationWindow): Promise<DailyDigestFulfillmentDaySummary>
  listLowStockItems(limit?: number): Promise<DailyDigestLowStockItem[]>
}

export class DailyDigestAggregationRepository implements DailyDigestAggregationDataSource {
  private readonly inventoryRepository: InventoryRepository

  constructor(private readonly db: DatabaseClient) {
    this.inventoryRepository = new InventoryRepository(db)
  }

  async getOrderStatusCounts(): Promise<DailyDigestOrderStatusCounts> {
    const rows = await this.db
      .select({
        status: orders.status,
        count: count(),
      })
      .from(orders)
      .groupBy(orders.status)

    const counts = new Map(rows.map((row) => [row.status, Number(row.count)]))

    return {
      pending: counts.get("pending") ?? 0,
      inProgress: counts.get("in_progress") ?? 0,
      partialReleased: counts.get("partial_released") ?? 0,
      completed: counts.get("completed") ?? 0,
      canceled: counts.get("canceled") ?? 0,
    }
  }

  async getInvoiceSnapshot(): Promise<DailyDigestInvoiceSnapshot> {
    const rows = await this.db
      .select({
        pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'pending')`,
        paidCount: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'paid')`,
        voidCount: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'void')`,
        outstandingBalance:
          sql<string>`COALESCE(SUM(${invoices.remainingBalance}), 0)::text`,
      })
      .from(invoices)

    const row = rows[0]

    return {
      pendingCount: Number(row?.pendingCount ?? 0),
      paidCount: Number(row?.paidCount ?? 0),
      voidCount: Number(row?.voidCount ?? 0),
      outstandingBalance: Number(row?.outstandingBalance ?? "0"),
    }
  }

  async getFulfillmentDaySummary(
    window: DailyDigestAggregationWindow,
  ): Promise<DailyDigestFulfillmentDaySummary> {
    const eventWindow = and(
      gte(orderLineItemProgressEvents.eventDate, window.startedAt),
      lt(orderLineItemProgressEvents.eventDate, window.endedAt),
    )
    const baseJoin = and(eventWindow, isNull(orders.archivedAt))

    const [eventTotalRow, stageRows, recentRaw] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(orderLineItemProgressEvents)
        .innerJoin(orderItems, eq(orderItems.id, orderLineItemProgressEvents.orderLineItemId))
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(baseJoin),
      this.db
        .select({
          stage: orderLineItemProgressEvents.stage,
          eventCount: count(),
          unitSum: sql<string>`coalesce(sum(${orderLineItemProgressEvents.quantity}), 0)::text`,
        })
        .from(orderLineItemProgressEvents)
        .innerJoin(orderItems, eq(orderItems.id, orderLineItemProgressEvents.orderLineItemId))
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(baseJoin)
        .groupBy(orderLineItemProgressEvents.stage),
      this.db
        .select({
          orderNumber: orders.orderNumber,
          lineLabel: orderItems.descriptionSnapshot,
          stage: orderLineItemProgressEvents.stage,
          quantity: orderLineItemProgressEvents.quantity,
        })
        .from(orderLineItemProgressEvents)
        .innerJoin(orderItems, eq(orderItems.id, orderLineItemProgressEvents.orderLineItemId))
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(baseJoin)
        .orderBy(
          desc(orderLineItemProgressEvents.eventDate),
          desc(orderLineItemProgressEvents.id),
        )
        .limit(12),
    ])

    const totalEvents = Number(eventTotalRow[0]?.value ?? 0)
    const unitsByStage = {
      printed: 0,
      qaPassed: 0,
      packed: 0,
      readyForRelease: 0,
      released: 0,
    }

    const addUnits: Record<string, keyof typeof unitsByStage> = {
      printed: "printed",
      qa_passed: "qaPassed",
      packed: "packed",
      ready_for_release: "readyForRelease",
      released: "released",
    }
    for (const row of stageRows) {
      const key = addUnits[row.stage]
      if (key) {
        unitsByStage[key] = Number(row.unitSum ?? "0")
      }
    }

    const totalUnits =
      unitsByStage.printed +
      unitsByStage.qaPassed +
      unitsByStage.packed +
      unitsByStage.readyForRelease +
      unitsByStage.released

    return {
      totalEvents,
      totalUnits,
      unitsByStage,
      recent: recentRaw.map((row) => ({
        orderNumber: row.orderNumber,
        lineLabel: row.lineLabel,
        stage: row.stage,
        quantity: row.quantity,
      })),
    }
  }

  async getActivityCounts(
    window: DailyDigestAggregationWindow,
  ): Promise<DailyDigestActivityCounts> {
    const range = and(gte(orders.createdAt, window.startedAt), lt(orders.createdAt, window.endedAt))
    const updateRange = and(
      gte(orders.updatedAt, window.startedAt),
      lt(orders.updatedAt, window.endedAt),
    )
    const invoiceCreatedRange = and(
      gte(invoices.createdAt, window.startedAt),
      lt(invoices.createdAt, window.endedAt),
    )
    const invoiceVoidRange = and(
      eq(invoices.status, "void"),
      gte(invoices.updatedAt, window.startedAt),
      lt(invoices.updatedAt, window.endedAt),
    )
    const paymentRange = and(
      gte(invoicePayments.paymentDate, window.startedAt),
      lt(invoicePayments.paymentDate, window.endedAt),
      isNull(invoicePayments.archivedAt),
    )
    const inventoryRange = and(
      gte(inventoryMovements.createdAt, window.startedAt),
      lt(inventoryMovements.createdAt, window.endedAt),
    )

    const [
      ordersCreatedRows,
      ordersUpdatedRows,
      invoicesCreatedRows,
      invoicesVoidedRows,
      paymentRows,
      inventoryRows,
    ] = await Promise.all([
      this.db.select({ value: count() }).from(orders).where(range),
      this.db.select({ value: count() }).from(orders).where(updateRange),
      this.db.select({ value: count() }).from(invoices).where(invoiceCreatedRange),
      this.db.select({ value: count() }).from(invoices).where(invoiceVoidRange),
      this.db
        .select({
          paymentCount: count(),
          totalPaidAmount: sql<string>`COALESCE(SUM(${invoicePayments.amount}), 0)::text`,
        })
        .from(invoicePayments)
        .where(paymentRange),
      this.db
        .select({
          stockIntakeCount:
            sql<number>`COUNT(*) FILTER (WHERE ${inventoryMovements.movementType} = 'stock_in')`,
          adjustmentCount:
            sql<number>`COUNT(*) FILTER (WHERE ${inventoryMovements.movementType} IN ('adjustment_in', 'adjustment_out'))`,
        })
        .from(inventoryMovements)
        .where(inventoryRange),
    ])

    return {
      ordersCreated: Number(ordersCreatedRows[0]?.value ?? 0),
      ordersUpdated: Number(ordersUpdatedRows[0]?.value ?? 0),
      invoicesCreated: Number(invoicesCreatedRows[0]?.value ?? 0),
      invoicesVoided: Number(invoicesVoidedRows[0]?.value ?? 0),
      paymentsRecorded: Number(paymentRows[0]?.paymentCount ?? 0),
      totalPaidAmount: Number(paymentRows[0]?.totalPaidAmount ?? "0"),
      stockIntakeCount: Number(inventoryRows[0]?.stockIntakeCount ?? 0),
      adjustmentCount: Number(inventoryRows[0]?.adjustmentCount ?? 0),
    }
  }

  async listLowStockItems(limit = 8): Promise<DailyDigestLowStockItem[]> {
    const balances = await this.inventoryRepository.listBalances({ includeInactive: false })

    return balances
      .map((balance) => {
        const available = balance.onHand - balance.reserved
        if (balance.itemType !== "cup") {
          return null
        }

        const reorderLevel = balance.cup.minStock

        if (available > reorderLevel) {
          return null
        }

        const name = `${balance.cup.sku} · ${balance.cup.size} ${balance.cup.diameter}`

        return {
          name,
          onHand: available,
          reorderLevel,
          status: available <= 0 ? ("out" as const) : ("low" as const),
        }
      })
      .filter((item): item is DailyDigestLowStockItem => item !== null)
      .sort((left, right) => {
        if (left.status !== right.status) {
          return left.status === "out" ? -1 : 1
        }

        return left.onHand - right.onHand
      })
      .slice(0, limit)
  }
}
