import { ReportsRepository } from "./reports.repository.js"
import type { CommercialSalesReportQuery, CupUsageReportQuery } from "./reports.schemas.js"
import type { SalesCostVisibilityReportQuery } from "./reports.schemas.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { assertCanViewConfidentialFields, assertPermission } from "../auth/authorization.js"
import {
  orderReportStatuses,
  toCupUsageReportDto,
  toInventoryReportItemDto,
  type InventoryReportDto,
  type CupUsageReportDto,
  type OrderStatusReportDto,
  type SalesCostVisibilityReportDto,
  type CommercialSalesReportDto,
  toCommercialSalesReportDto,
  toSalesCostVisibilityReportDto,
} from "./reports.types.js"

export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  async getInventorySummary(user: SafeUser): Promise<InventoryReportDto> {
    assertPermission(user, "reports.view")

    const balances = await this.reportsRepository.listInventoryBalances()

    return {
      low_stock_basis: "available",
      low_stock_scope: "cup_min_stock_only",
      items: balances.map(toInventoryReportItemDto),
    }
  }

  async getLowStock(user: SafeUser): Promise<InventoryReportDto> {
    const summary = await this.getInventorySummary(user)

    return {
      low_stock_basis: summary.low_stock_basis,
      low_stock_scope: summary.low_stock_scope,
      items: summary.items.filter((item) => item.item_type === "cup" && item.is_low_stock),
    }
  }

  async getOrderStatusReport(user: SafeUser): Promise<OrderStatusReportDto> {
    assertPermission(user, "reports.view")

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

  async getCupUsageReport(query: CupUsageReportQuery, user: SafeUser): Promise<CupUsageReportDto> {
    assertPermission(user, "reports.view")

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
    assertPermission(user, "reports.view")
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

  async getCommercialSalesReport(
    query: CommercialSalesReportQuery,
    user: SafeUser,
  ): Promise<CommercialSalesReportDto> {
    assertPermission(user, "reports.view")
    assertCanViewConfidentialFields(user)

    const [rows, represented] = await Promise.all([
      this.reportsRepository.listCommercialSales(query),
      this.reportsRepository.countCommercialSalesRepresented(query),
    ])

    return toCommercialSalesReportDto(
      query,
      rows.map((row) => ({
        item_type: row.itemType,
        item_id: row.itemId,
        description_snapshot: row.descriptionSnapshot,
        quantity_sold: row.quantitySold,
        revenue: row.revenue,
        average_unit_price: row.averageUnitPrice,
        invoice_count: row.invoiceCount,
        order_count: row.orderCount,
      })),
      represented,
    )
  }
}
