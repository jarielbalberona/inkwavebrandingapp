import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createStockIntake,
  listInventoryBalances,
  type StockIntakePayload,
} from "@/features/inventory/api/inventory-client"
import { cupsQueryKey } from "@/features/cups/hooks/use-cups"

export const inventoryBalancesQueryKey = ["inventory", "balances"] as const

export function useInventoryBalancesQuery() {
  return useQuery({
    queryKey: inventoryBalancesQueryKey,
    queryFn: listInventoryBalances,
  })
}

export function useStockIntakeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: StockIntakePayload) => createStockIntake(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cupsQueryKey })
      await queryClient.invalidateQueries({ queryKey: inventoryBalancesQueryKey })
    },
  })
}
