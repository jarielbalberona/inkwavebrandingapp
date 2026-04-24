import { ReportsRepository } from "./reports.repository.js"
import type { CupUsageReportQuery } from "./reports.schemas.js"
import type { SalesCostVisibilityReportQuery } from "./reports.schemas.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { assertCanViewConfidentialFields } from "../auth/authorization.js"
import {
  orderReportStatuses,
  toCupUsageReportDto,
  toInventoryReportItemDto,
  type InventoryReportDto,
  type CupUsageReportDto,
  type OrderStatusReportDto,
  type SalesCostVisibilityReportDto,
  toSalesCostVisibilityReportDto,
} from "./reports.types.js"

export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  async getInventorySummary(): Promise<InventoryReportDto> {
    const balances = await this.reportsRepository.listInventoryBalances()

    return {
      low_stock_basis: "available",
      low_stock_scope: "cup_min_stock_only",
      items: balances.map(toInventoryReportItemDto),
    }
  }

  async getLowStock(): Promise<InventoryReportDto> {
    const summary = await this.getInventorySummary()

    return {
      low_stock_basis: summary.low_stock_basis,
      low_stock_scope: summary.low_stock_scope,
      items: summary.items.filter((item) => item.item_type === "cup" && item.is_low_stock),
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

  async getCupUsageReport(query: CupUsageReportQuery): Promise<CupUsageReportDto> {
    const rows = await this.reportsRepository.listCupUsage(query)

    return toCupUsageReportDto(
      query,
      rows.map((row) => ({
        cup: row.cup,
        consumed_quantity: row.consumedQuantity,
      })),
    )
  }

  async getSalesCostVisibilityReport(
    query: SalesCostVisibilityReportQuery,
    user: SafeUser,
  ): Promise<SalesCostVisibilityReportDto> {
    assertCanViewConfidentialFields(user)

    const rows = await this.reportsRepository.listSalesCostVisibility(query)

    return toSalesCostVisibilityReportDto(
      query,
      rows.map((row) => ({
        cup: row.cup,
        released_quantity: row.releasedQuantity,
        sell_total: row.sellTotal,
        cost_total: row.costTotal,
        gross_profit: row.grossProfit,
      })),
    )
  }
}
