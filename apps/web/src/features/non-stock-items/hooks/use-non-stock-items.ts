import { useQuery } from "@tanstack/react-query"

import { listNonStockItems } from "@/features/non-stock-items/api/non-stock-items-client"

export const nonStockItemsQueryKey = ["non-stock-items"] as const

export function useNonStockItemsQuery() {
  return useQuery({
    queryKey: nonStockItemsQueryKey,
    queryFn: listNonStockItems,
  })
}
