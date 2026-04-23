import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  createStockIntake,
  type StockIntakePayload,
} from "@/features/inventory/api/inventory-client"
import { cupsQueryKey } from "@/features/cups/hooks/use-cups"

export function useStockIntakeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: StockIntakePayload) => createStockIntake(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cupsQueryKey })
    },
  })
}
