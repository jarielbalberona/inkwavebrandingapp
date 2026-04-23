import { useQuery } from "@tanstack/react-query"

import { getDashboardSummary } from "@/features/dashboard/api/dashboard-client"

export const dashboardQueryKey = ["dashboard"] as const

export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: [...dashboardQueryKey, "summary"] as const,
    queryFn: getDashboardSummary,
  })
}
