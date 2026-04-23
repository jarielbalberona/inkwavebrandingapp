import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createCup,
  listCups,
  updateCup,
  type CupPayload,
} from "@/features/cups/api/cups-client"

export const cupsQueryKey = ["cups"] as const

export function useCupsQuery() {
  return useQuery({
    queryKey: cupsQueryKey,
    queryFn: listCups,
  })
}

export function useCreateCupMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CupPayload) => createCup(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cupsQueryKey })
    },
  })
}

export function useUpdateCupMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CupPayload }) => updateCup(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cupsQueryKey })
    },
  })
}
