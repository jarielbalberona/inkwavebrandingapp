import { ReportsRepository } from "./reports.repository.js"
import {
  toInventoryReportItemDto,
  type InventoryReportDto,
} from "./reports.types.js"

export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  async getInventorySummary(): Promise<InventoryReportDto> {
    const balances = await this.reportsRepository.listInventoryBalances()

    return {
      low_stock_basis: "available",
      items: balances.map(toInventoryReportItemDto),
    }
  }

  async getLowStock(): Promise<InventoryReportDto> {
    const summary = await this.getInventorySummary()

    return {
      low_stock_basis: summary.low_stock_basis,
      items: summary.items.filter((item) => item.is_low_stock),
    }
  }
}
