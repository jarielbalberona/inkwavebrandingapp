import { DashboardRepository } from "./dashboard.repository.js"
import {
  orderReportStatuses,
  type DashboardSummaryDto,
} from "./dashboard.types.js"

export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    const [balances, orderRows] = await Promise.all([
      this.dashboardRepository.listInventoryBalances(),
      this.dashboardRepository.countOrdersByStatus(),
    ])
    const cupBalances = balances.filter((balance) => balance.itemType === "cup")
    const lidBalances = balances.filter((balance) => balance.itemType === "lid")

    const countsByStatus = new Map(orderRows.map((row) => [row.status, row.count]))
    const statuses = orderReportStatuses.map((status) => ({
      status,
      count: countsByStatus.get(status) ?? 0,
    }))

    return {
      inventory: {
        tracked_items: balances.length,
        tracked_cup_count: cupBalances.length,
        tracked_lid_count: lidBalances.length,
        low_stock_cup_count: cupBalances.filter(
          (balance) => balance.onHand - balance.reserved <= balance.cup.minStock,
        ).length,
      },
      orders: {
        statuses,
        total_orders: statuses.reduce((total, item) => total + item.count, 0),
        pending_count: countsByStatus.get("pending") ?? 0,
        partial_released_count: countsByStatus.get("partial_released") ?? 0,
      },
    }
  }
}
