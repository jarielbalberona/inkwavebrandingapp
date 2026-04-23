import { InventoryRepository } from "../inventory/inventory.repository.js"

export class ReportsRepository {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async listInventoryBalances() {
    return this.inventoryRepository.listBalances({ includeInactive: true })
  }
}
