import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createUser,
  listUsers,
  updateUserPermissions,
  type CreateUserPayload,
  type UpdateUserPermissionsPayload,
} from "@/features/users/api/users-client"

export const usersQueryKey = ["users"] as const

export function useUsersQuery(enabled = true) {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: listUsers,
    enabled,
  })
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
  })
}

export function useUpdateUserPermissionsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPermissionsPayload }) =>
      updateUserPermissions(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
  })
}
