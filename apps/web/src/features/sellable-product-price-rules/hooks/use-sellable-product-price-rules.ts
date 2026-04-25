import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createSellableProductPriceRule,
  listSellableProductPriceRules,
  updateSellableProductPriceRule,
  type SellableProductPriceRulePayload,
} from "@/features/sellable-product-price-rules/api/sellable-product-price-rules-client"

export const sellableProductPriceRulesQueryKey = ["sellable-product-price-rules"] as const

export function useSellableProductPriceRulesQuery() {
  return useQuery({
    queryKey: sellableProductPriceRulesQueryKey,
    queryFn: listSellableProductPriceRules,
  })
}

export function useCreateSellableProductPriceRuleMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SellableProductPriceRulePayload) =>
      createSellableProductPriceRule(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sellableProductPriceRulesQueryKey })
    },
  })
}

export function useUpdateSellableProductPriceRuleMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SellableProductPriceRulePayload }) =>
      updateSellableProductPriceRule(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sellableProductPriceRulesQueryKey })
    },
  })
}
