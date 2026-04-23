import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createOrder,
  listOrders,
  type CreateOrderPayload,
  type OrderStatus,
} from "@/features/orders/api/orders-client"

export const ordersQueryKey = ["orders"] as const

export const orderStatusOptions = [
  "pending",
  "in_progress",
  "partial_released",
  "completed",
  "canceled",
] as const satisfies readonly OrderStatus[]

export function useOrdersQuery(filters: { status?: OrderStatus } = {}) {
  return useQuery({
    queryKey: [...ordersQueryKey, filters] as const,
    queryFn: () => listOrders(filters),
  })
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => createOrder(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey })
    },
  })
}
