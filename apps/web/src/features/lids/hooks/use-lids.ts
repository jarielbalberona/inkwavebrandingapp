import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createLid,
  listLids,
  updateLid,
  type LidPayload,
} from "@/features/lids/api/lids-client"

export const lidsQueryKey = ["lids"] as const

export function useLidsQuery() {
  return useQuery({
    queryKey: lidsQueryKey,
    queryFn: listLids,
  })
}

export function useCreateLidMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LidPayload) => createLid(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: lidsQueryKey })
    },
  })
}

export function useUpdateLidMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<LidPayload> }) =>
      updateLid(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: lidsQueryKey })
    },
  })
}
