import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createCustomer,
  listCustomers,
  updateCustomer,
  type CustomerPayload,
} from "@/features/customers/api/customers-client"

export const customersQueryKey = ["customers"] as const

export function useCustomersQuery(filters: {
  includeInactive?: boolean
  search?: string
} = {}) {
  return useQuery({
    queryKey: [...customersQueryKey, filters],
    queryFn: () => listCustomers(filters),
  })
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CustomerPayload) => createCustomer(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKey })
    },
  })
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CustomerPayload> }) =>
      updateCustomer(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKey })
    },
  })
}
