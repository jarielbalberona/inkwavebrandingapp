import { and, asc, gte, isNotNull, lte, eq, or, sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { cups, inventoryMovements, invoices, invoiceItems, orders } from "../../db/schema/index.js"
import { orderItems, orderLineItemProgressEvents } from "../../db/schema/index.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"
import type { CommercialSalesReportQuery, CupUsageReportQuery } from "./reports.schemas.js"
import type { SalesCostVisibilityReportQuery } from "./reports.schemas.js"
import type {
  CupUsageReportItemDto,
  SalesCostVisibilityReportItemDto,
} from "./reports.types.js"

export interface OrderStatusCountRow {
  status: string
  count: number
}

export interface CupUsageRow {
  cup: CupUsageReportItemDto["cup"]
  consumedQuantity: number
}

export interface SalesCostVisibilityRow {
  cup: SalesCostVisibilityReportItemDto["cup"]
  releasedQuantity: number
  sellTotal: string
  costTotal: string
  grossProfit: string
}

export interface CommercialSalesRow {
  itemType: "product_bundle" | "cup" | "lid" | "non_stock_item" | "custom_charge"
  itemId: string | null
  descriptionSnapshot: string
  quantitySold: number
  revenue: string
  averageUnitPrice: string
  invoiceCount: number
  orderCount: number
}

export class ReportsRepository {
  constructor(
    private readonly db: DatabaseClient,
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  async listInventoryBalances() {
    return this.inventoryRepository.listBalances({ includeInactive: true })
  }

  async countOrdersByStatus(): Promise<OrderStatusCountRow[]> {
    const rows = await this.db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .groupBy(orders.status)

    return rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
    }))
  }

  async listCupUsage(query: CupUsageReportQuery): Promise<CupUsageRow[]> {
    const conditions = [
      or(
        eq(inventoryMovements.movementType, "consume"),
        and(
          eq(inventoryMovements.movementType, "adjustment_out"),
          isNotNull(inventoryMovements.orderItemId),
        ),
      ),
      query.start_date ? gte(inventoryMovements.createdAt, query.start_date) : undefined,
      query.end_date ? lte(inventoryMovements.createdAt, query.end_date) : undefined,
    ].filter(Boolean)

    const rows = await this.db
      .select({
        cup: {
          id: cups.id,
          sku: cups.sku,
          type: cups.type,
          brand: cups.brand,
          diameter: cups.diameter,
          size: cups.size,
          color: cups.color,
          is_active: cups.isActive,
        },
        consumedQuantity: sql<number>`COALESCE(SUM(${inventoryMovements.quantity}), 0)`,
      })
      .from(inventoryMovements)
      .innerJoin(cups, eq(inventoryMovements.cupId, cups.id))
      .where(and(...conditions))
      .groupBy(
        cups.id,
        cups.sku,
        cups.type,
        cups.brand,
        cups.diameter,
        cups.size,
        cups.color,
        cups.isActive,
      )
      .orderBy(asc(cups.sku))

    return rows.map((row) => ({
      cup: row.cup,
      consumedQuantity: Number(row.consumedQuantity),
    }))
  }

  async listSalesCostVisibility(
    query: SalesCostVisibilityReportQuery,
  ): Promise<SalesCostVisibilityRow[]> {
    const conditions = [
      eq(orderLineItemProgressEvents.stage, "released"),
      query.start_date ? gte(orderLineItemProgressEvents.eventDate, query.start_date) : undefined,
      query.end_date ? lte(orderLineItemProgressEvents.eventDate, query.end_date) : undefined,
    ].filter(Boolean)

    const rows = await this.db
      .select({
        cup: {
          id: cups.id,
          sku: cups.sku,
          type: cups.type,
          brand: cups.brand,
          diameter: cups.diameter,
          size: cups.size,
          color: cups.color,
          is_active: cups.isActive,
        },
        releasedQuantity: sql<number>`COALESCE(SUM(${orderLineItemProgressEvents.quantity}), 0)`,
        sellTotal:
          sql<string>`COALESCE(SUM((${orderLineItemProgressEvents.quantity}::numeric) * ${orderItems.unitSellPrice}), 0)::text`,
        costTotal:
          sql<string>`COALESCE(SUM((${orderLineItemProgressEvents.quantity}::numeric) * ${orderItems.unitCostPrice}), 0)::text`,
        grossProfit:
          sql<string>`COALESCE(SUM((${orderLineItemProgressEvents.quantity}::numeric) * (${orderItems.unitSellPrice} - ${orderItems.unitCostPrice})), 0)::text`,
      })
      .from(orderLineItemProgressEvents)
      .innerJoin(orderItems, eq(orderLineItemProgressEvents.orderLineItemId, orderItems.id))
      .innerJoin(cups, eq(orderItems.cupId, cups.id))
      .where(and(...conditions))
      .groupBy(
        cups.id,
        cups.sku,
        cups.type,
        cups.brand,
        cups.diameter,
        cups.size,
        cups.color,
        cups.isActive,
      )
      .orderBy(asc(cups.sku))

    return rows.map((row) => ({
      cup: row.cup,
      releasedQuantity: Number(row.releasedQuantity),
      sellTotal: toMoneyString(row.sellTotal),
      costTotal: toMoneyString(row.costTotal),
      grossProfit: toMoneyString(row.grossProfit),
    }))
  }

  async listCommercialSales(query: CommercialSalesReportQuery): Promise<CommercialSalesRow[]> {
    const itemIdExpression = sql<string | null>`CASE
      WHEN ${invoiceItems.itemType} = 'product_bundle' THEN ${orderItems.productBundleId}
      WHEN ${invoiceItems.itemType} = 'cup' THEN ${orderItems.cupId}
      WHEN ${invoiceItems.itemType} = 'lid' THEN ${orderItems.lidId}
      WHEN ${invoiceItems.itemType} = 'non_stock_item' THEN ${orderItems.nonStockItemId}
      ELSE NULL
    END`
    const conditions = [
      query.start_date ? gte(invoices.createdAt, query.start_date) : undefined,
      query.end_date ? lte(invoices.createdAt, query.end_date) : undefined,
      query.item_type ? eq(invoiceItems.itemType, query.item_type) : undefined,
      query.product_bundle_id
        ? eq(orderItems.productBundleId, query.product_bundle_id)
        : undefined,
    ].filter(Boolean)

    const rows = await this.db
      .select({
        itemType: invoiceItems.itemType,
        itemId: itemIdExpression,
        descriptionSnapshot: invoiceItems.descriptionSnapshot,
        quantitySold: sql<number>`COALESCE(SUM(${invoiceItems.quantity}), 0)`,
        revenue: sql<string>`COALESCE(SUM(${invoiceItems.lineTotal}), 0)::text`,
        averageUnitPrice:
          sql<string>`CASE WHEN COALESCE(SUM(${invoiceItems.quantity}), 0) = 0 THEN '0' ELSE (COALESCE(SUM(${invoiceItems.lineTotal}), 0) / SUM(${invoiceItems.quantity}))::text END`,
        invoiceCount: sql<number>`COUNT(DISTINCT ${invoiceItems.invoiceId})`,
        orderCount: sql<number>`COUNT(DISTINCT ${invoices.orderId})`,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .innerJoin(orderItems, eq(invoiceItems.orderItemId, orderItems.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(invoiceItems.itemType, itemIdExpression, invoiceItems.descriptionSnapshot)
      .orderBy(asc(invoiceItems.itemType), asc(invoiceItems.descriptionSnapshot))

    return rows.map((row) => ({
      itemType: row.itemType,
      itemId: row.itemId,
      descriptionSnapshot: row.descriptionSnapshot,
      quantitySold: Number(row.quantitySold),
      revenue: toMoneyString(row.revenue),
      averageUnitPrice: toMoneyString(row.averageUnitPrice),
      invoiceCount: Number(row.invoiceCount),
      orderCount: Number(row.orderCount),
    }))
  }

  async countCommercialSalesRepresented(query: CommercialSalesReportQuery): Promise<{
    invoiceCount: number
    orderCount: number
  }> {
    const conditions = [
      query.start_date ? gte(invoices.createdAt, query.start_date) : undefined,
      query.end_date ? lte(invoices.createdAt, query.end_date) : undefined,
      query.item_type ? eq(invoiceItems.itemType, query.item_type) : undefined,
      query.product_bundle_id
        ? eq(orderItems.productBundleId, query.product_bundle_id)
        : undefined,
    ].filter(Boolean)

    const rows = await this.db
      .select({
        invoiceCount: sql<number>`COUNT(DISTINCT ${invoiceItems.invoiceId})`,
        orderCount: sql<number>`COUNT(DISTINCT ${invoices.orderId})`,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .innerJoin(orderItems, eq(invoiceItems.orderItemId, orderItems.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    return {
      invoiceCount: Number(rows[0]?.invoiceCount ?? 0),
      orderCount: Number(rows[0]?.orderCount ?? 0),
    }
  }
}

function toMoneyString(value: string): string {
  return Number(value).toFixed(2)
}
