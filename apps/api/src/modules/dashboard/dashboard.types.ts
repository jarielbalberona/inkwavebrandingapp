import { orderReportStatuses, type OrderReportStatus } from "../reports/reports.types.js"

export { orderReportStatuses }

export interface DashboardOrderStatusCountDto {
  status: OrderReportStatus
  count: number
}

export interface DashboardSummaryDto {
  inventory: {
    tracked_items: number
    tracked_cup_count: number
    tracked_lid_count: number
    low_stock_cup_count: number
  }
  orders: {
    statuses: DashboardOrderStatusCountDto[]
    total_orders: number
    pending_count: number
    partial_released_count: number
  }
}
