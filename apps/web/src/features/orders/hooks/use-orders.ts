import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createOrder,
  createProgressEvent,
  getOrder,
  listOrders,
  listProgressEvents,
  type CreateOrderPayload,
  type CreateProgressEventPayload,
  type OrderStatus,
} from "@/features/orders/api/orders-client"

export const ordersQueryKey = ["orders"] as const
export const orderProgressEventsQueryKey = ["orders", "progress-events"] as const

export const orderStatusOptions = [
  "pending",
  "in_progress",
  "partial_released",
  "completed",
  "canceled",
] as const satisfies readonly OrderStatus[]

export const progressStageOptions = [
  "printed",
  "qa_passed",
  "packed",
  "ready_for_release",
  "released",
] as const

export function useOrdersQuery(filters: { status?: OrderStatus } = {}) {
  return useQuery({
    queryKey: [...ordersQueryKey, filters] as const,
    queryFn: () => listOrders(filters),
  })
}

export function useOrderQuery(id: string | null) {
  return useQuery({
    queryKey: [...ordersQueryKey, "detail", id] as const,
    queryFn: () => getOrder(id ?? ""),
    enabled: Boolean(id),
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

export function useProgressEventsQuery(orderLineItemId: string | null) {
  return useQuery({
    queryKey: [...orderProgressEventsQueryKey, orderLineItemId] as const,
    queryFn: () => listProgressEvents(orderLineItemId ?? ""),
    enabled: Boolean(orderLineItemId),
  })
}

export function useCreateProgressEventMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      orderLineItemId,
      payload,
    }: {
      orderLineItemId: string
      payload: CreateProgressEventPayload
    }) => createProgressEvent(orderLineItemId, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey })
      await queryClient.invalidateQueries({
        queryKey: [...orderProgressEventsQueryKey, variables.orderLineItemId],
      })
    },
  })
}
