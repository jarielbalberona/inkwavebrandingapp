import { useQuery } from "@tanstack/react-query"

import {
  getInventorySummaryReport,
  getLowStockReport,
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
