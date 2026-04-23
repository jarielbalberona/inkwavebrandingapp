import { sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { orders } from "../../db/schema/index.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"

export interface OrderStatusCountRow {
  status: string
  count: number
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
}
