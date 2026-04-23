import { orderReportStatuses, type OrderReportStatus } from "../reports/reports.types.js"

export { orderReportStatuses }

export interface DashboardOrderStatusCountDto {
  status: OrderReportStatus
  count: number
}

export interface DashboardSummaryDto {
  inventory: {
    tracked_cups: number
    low_stock_count: number
  }
  orders: {
    statuses: DashboardOrderStatusCountDto[]
    total_orders: number
    pending_count: number
    partial_released_count: number
  }
}
