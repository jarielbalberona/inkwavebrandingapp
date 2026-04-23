import { and, asc, gte, lte, eq, sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { cups, inventoryMovements, orders } from "../../db/schema/index.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"
import type { CupUsageReportQuery } from "./reports.schemas.js"
import type { CupUsageReportItemDto } from "./reports.types.js"

export interface OrderStatusCountRow {
  status: string
  count: number
}

export interface CupUsageRow {
  cup: CupUsageReportItemDto["cup"]
  consumedQuantity: number
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
      eq(inventoryMovements.movementType, "consume"),
      query.start_date ? gte(inventoryMovements.createdAt, query.start_date) : undefined,
      query.end_date ? lte(inventoryMovements.createdAt, query.end_date) : undefined,
    ].filter(Boolean)

    const rows = await this.db
      .select({
        cup: {
          id: cups.id,
          sku: cups.sku,
          brand: cups.brand,
          size: cups.size,
          dimension: cups.dimension,
          material: cups.material,
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
        cups.brand,
        cups.size,
        cups.dimension,
        cups.material,
        cups.color,
        cups.isActive,
      )
      .orderBy(asc(cups.sku))

    return rows.map((row) => ({
      cup: row.cup,
      consumedQuantity: Number(row.consumedQuantity),
    }))
  }
}
