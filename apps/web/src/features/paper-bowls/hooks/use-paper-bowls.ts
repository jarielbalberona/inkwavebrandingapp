import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createPaperBowl,
  listPaperBowls,
  updatePaperBowl,
  type PaperBowlPayload,
} from "../api/paper-bowls-client"

export const paperBowlsQueryKey = ["paper-bowls"] as const

export function usePaperBowlsQuery() {
  return useQuery({ queryKey: paperBowlsQueryKey, queryFn: listPaperBowls })
}

export function useCreatePaperBowlMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createPaperBowl,
    onSuccess: () => client.invalidateQueries({ queryKey: paperBowlsQueryKey }),
  })
}

export function useUpdatePaperBowlMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PaperBowlPayload }) =>
      updatePaperBowl(id, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: paperBowlsQueryKey }),
  })
}
