import { useQuery } from "@tanstack/react-query"

import {
  getCupUsageReport,
  getInventorySummaryReport,
  getLowStockReport,
  getOrderStatusReport,
  getSalesCostReport,
} from "@/features/reports/api/reports-client"

export const reportsQueryKey = ["reports"] as const

export function useInventorySummaryReportQuery() {
  return useQuery({
    queryKey: [...reportsQueryKey, "inventory-summary"] as const,
    queryFn: getInventorySummaryReport,
  })
}

export function useLowStockReportQuery() {
  return useQuery({
    queryKey: [...reportsQueryKey, "low-stock"] as const,
    queryFn: getLowStockReport,
  })
}

export function useOrderStatusReportQuery() {
  return useQuery({
    queryKey: [...reportsQueryKey, "order-status"] as const,
    queryFn: getOrderStatusReport,
  })
}

export function useCupUsageReportQuery() {
  return useQuery({
    queryKey: [...reportsQueryKey, "cup-usage"] as const,
    queryFn: getCupUsageReport,
  })
}

export function useSalesCostReportQuery(enabled: boolean) {
  return useQuery({
    queryKey: [...reportsQueryKey, "sales-cost"] as const,
    queryFn: getSalesCostReport,
    enabled,
  })
}
