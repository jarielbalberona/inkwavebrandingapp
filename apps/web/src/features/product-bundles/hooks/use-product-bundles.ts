import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createProductBundle,
  listProductBundles,
  updateProductBundle,
  type ProductBundlePayload,
} from "@/features/product-bundles/api/product-bundles-client"

export const productBundlesQueryKey = ["product-bundles"] as const

export function useProductBundlesQuery() {
  return useQuery({
    queryKey: productBundlesQueryKey,
    queryFn: listProductBundles,
  })
}

export function useCreateProductBundleMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ProductBundlePayload) => createProductBundle(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productBundlesQueryKey })
    },
  })
}

export function useUpdateProductBundleMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProductBundlePayload }) =>
      updateProductBundle(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productBundlesQueryKey })
    },
  })
}
