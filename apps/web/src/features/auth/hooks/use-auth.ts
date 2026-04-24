import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  fetchCurrentUser,
  login,
  logout,
  type AuthenticatedUser,
  type LoginInput,
} from "@/features/auth/api/auth-client"

export const currentUserQueryKey = ["auth", "me"] as const

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 30_000,
  })
}

export function useLoginMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (user: AuthenticatedUser) => {
      queryClient.setQueryData(currentUserQueryKey, user)
    },
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.setQueryData(currentUserQueryKey, null)
    },
  })
}
