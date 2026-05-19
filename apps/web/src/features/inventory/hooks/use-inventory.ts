import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createInventoryAdjustment,
  createStockIntake,
  getInventoryItemDetail,
  type InventoryAdjustmentPayload,
  listInventoryMovements,
  listInventoryBalances,
  type InventoryItemType,
  type StockIntakePayload,
} from "@/features/inventory/api/inventory-client"
import { cupsQueryKey } from "@/features/cups/hooks/use-cups"
import { lidsQueryKey } from "@/features/lids/hooks/use-lids"

export const inventoryBalancesQueryKey = ["inventory", "balances"] as const
export const inventoryMovementsQueryKey = ["inventory", "movements"] as const
export const inventoryItemDetailQueryKey = ["inventory", "detail"] as const
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
    queryFn: () => listInventoryBalances(),
  })
}

export function useInventoryMovementsQuery(filters: {
  itemType?: InventoryItemType
  itemId?: string
  movementType?: string
}) {
  return useQuery({
    queryKey: [...inventoryMovementsQueryKey, filters] as const,
    queryFn: () => listInventoryMovements(filters),
  })
}

export function useInventoryItemDetailQuery(
  itemType: InventoryItemType | null,
  itemId: string | null
) {
  return useQuery({
    queryKey: [...inventoryItemDetailQueryKey, itemType, itemId] as const,
    queryFn: () => getInventoryItemDetail(itemType!, itemId!),
    enabled: Boolean(itemType && itemId),
  })
}

export function useStockIntakeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: StockIntakePayload) => createStockIntake(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cupsQueryKey })
      await queryClient.invalidateQueries({ queryKey: lidsQueryKey })
      await queryClient.invalidateQueries({
        queryKey: inventoryBalancesQueryKey,
      })
      await queryClient.invalidateQueries({
        queryKey: inventoryMovementsQueryKey,
      })
      await queryClient.invalidateQueries({
        queryKey: inventoryItemDetailQueryKey,
      })
    },
  })
}

export function useInventoryAdjustmentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: InventoryAdjustmentPayload) =>
      createInventoryAdjustment(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cupsQueryKey })
      await queryClient.invalidateQueries({ queryKey: lidsQueryKey })
      await queryClient.invalidateQueries({
        queryKey: inventoryBalancesQueryKey,
      })
      await queryClient.invalidateQueries({
        queryKey: inventoryMovementsQueryKey,
      })
      await queryClient.invalidateQueries({
        queryKey: inventoryItemDetailQueryKey,
      })
    },
  })
}
