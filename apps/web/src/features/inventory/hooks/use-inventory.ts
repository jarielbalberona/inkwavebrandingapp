import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createStockIntake,
  listInventoryMovements,
  listInventoryBalances,
  type StockIntakePayload,
} from "@/features/inventory/api/inventory-client"
import { cupsQueryKey } from "@/features/cups/hooks/use-cups"

export const inventoryBalancesQueryKey = ["inventory", "balances"] as const
export const inventoryMovementsQueryKey = ["inventory", "movements"] as const
export const inventoryMovementTypeOptions = [
  "stock_in",
  "reserve",
  "release_reservation",
  "consume",
  "adjustment_in",
  "adjustment_out",
] as const

export function useInventoryBalancesQuery() {
  return useQuery({
    queryKey: inventoryBalancesQueryKey,
    queryFn: listInventoryBalances,
  })
}

export function useInventoryMovementsQuery(filters: {
  cupId?: string
  movementType?: string
}) {
  return useQuery({
    queryKey: [...inventoryMovementsQueryKey, filters] as const,
    queryFn: () => listInventoryMovements(filters),
  })
}

export function useStockIntakeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: StockIntakePayload) => createStockIntake(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cupsQueryKey })
      await queryClient.invalidateQueries({ queryKey: inventoryBalancesQueryKey })
      await queryClient.invalidateQueries({ queryKey: inventoryMovementsQueryKey })
    },
  })
}
