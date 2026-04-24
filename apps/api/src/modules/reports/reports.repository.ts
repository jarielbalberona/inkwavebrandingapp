import { and, asc, gte, isNotNull, lte, eq, or, sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { cups, inventoryMovements, orders } from "../../db/schema/index.js"
import { orderItems, orderLineItemProgressEvents } from "../../db/schema/index.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"
import type { CupUsageReportQuery } from "./reports.schemas.js"
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
}

function toMoneyString(value: string): string {
  return Number(value).toFixed(2)
}
