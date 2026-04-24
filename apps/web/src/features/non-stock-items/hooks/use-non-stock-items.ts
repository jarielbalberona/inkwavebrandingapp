import { useQuery } from "@tanstack/react-query"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  createNonStockItem,
  listNonStockItems,
  updateNonStockItem,
  type NonStockItemPayload,
} from "@/features/non-stock-items/api/non-stock-items-client"

export const nonStockItemsQueryKey = ["non-stock-items"] as const

export function useNonStockItemsQuery() {
  return useQuery({
    queryKey: nonStockItemsQueryKey,
    queryFn: listNonStockItems,
  })
}

export function useCreateNonStockItemMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: NonStockItemPayload) => createNonStockItem(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: nonStockItemsQueryKey })
    },
  })
}

export function useUpdateNonStockItemMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: NonStockItemPayload }) =>
      updateNonStockItem(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: nonStockItemsQueryKey })
    },
  })
}
