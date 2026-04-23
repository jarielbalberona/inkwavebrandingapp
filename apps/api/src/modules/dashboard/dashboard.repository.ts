import type { DatabaseClient } from "../../db/client.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"
import { ReportsRepository } from "../reports/reports.repository.js"

export class DashboardRepository {
  private readonly inventoryRepository: InventoryRepository
  private readonly reportsRepository: ReportsRepository

  constructor(private readonly db: DatabaseClient) {
    this.inventoryRepository = new InventoryRepository(db)
    this.reportsRepository = new ReportsRepository(db, this.inventoryRepository)
  }

  async listInventoryBalances() {
    return this.inventoryRepository.listBalances({ includeInactive: true })
  }

  async countOrdersByStatus() {
    return this.reportsRepository.countOrdersByStatus()
  }
}
