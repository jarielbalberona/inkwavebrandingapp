import { ReportsRepository } from "./reports.repository.js"
import {
  orderReportStatuses,
  toInventoryReportItemDto,
  type InventoryReportDto,
  type OrderStatusReportDto,
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

  async getOrderStatusReport(): Promise<OrderStatusReportDto> {
    const rows = await this.reportsRepository.countOrdersByStatus()
    const countsByStatus = new Map(rows.map((row) => [row.status, row.count]))
    const statuses = orderReportStatuses.map((status) => ({
      status,
      count: countsByStatus.get(status) ?? 0,
    }))

    return {
      statuses,
      total_orders: statuses.reduce((total, item) => total + item.count, 0),
    }
  }
}
