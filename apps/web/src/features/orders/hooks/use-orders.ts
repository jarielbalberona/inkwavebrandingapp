import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  cancelOrder,
  archiveOrder,
  createOrder,
  createProgressEvent,
  generateOrderInvoice,
  getOrder,
  getOrderInvoice,
  listOrders,
  listProgressEvents,
  updateOrder,
  updateOrderPriorities,
  type CreateOrderPayload,
  type CreateProgressEventPayload,
  type Order,
  type OrderStatus,
  type UpdateOrderPayload,
  type UpdateOrderPrioritiesPayload,
} from "@/features/orders/api/orders-client"

export const ordersQueryKey = ["orders"] as const
export const orderProgressEventsQueryKey = ["orders", "progress-events"] as const
export const orderInvoicesQueryKey = ["orders", "invoice"] as const

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

export function useOrdersQuery(filters: { status?: OrderStatus; includeArchived?: boolean } = {}) {
  return useQuery({
    queryKey: [...ordersQueryKey, filters] as const,
    queryFn: () => listOrders(filters),
  })
}

export function useArchiveOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => archiveOrder(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey })
      await queryClient.invalidateQueries({ queryKey: orderInvoicesQueryKey })
      await queryClient.invalidateQueries({ queryKey: orderProgressEventsQueryKey })
    },
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

export function useCancelOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => cancelOrder(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey })
      await queryClient.invalidateQueries({ queryKey: orderProgressEventsQueryKey })
    },
  })
}

export function useUpdateOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOrderPayload }) =>
      updateOrder(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey })
    },
  })
}

export function useUpdateOrderPrioritiesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateOrderPrioritiesPayload) => updateOrderPriorities(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ordersQueryKey })

      const previousEntries = queryClient.getQueriesData<Order[]>({
        queryKey: ordersQueryKey,
      })

      queryClient.setQueriesData({ queryKey: ordersQueryKey }, (current) => {
        if (!Array.isArray(current)) {
          return current
        }

        return applyPriorityOrderToOrders(current, payload.order_ids)
      })

      return { previousEntries }
    },
    onError: (_error, _payload, context) => {
      context?.previousEntries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey })
    },
  })
}

export function useProgressEventsQuery(orderLineItemId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...orderProgressEventsQueryKey, orderLineItemId] as const,
    queryFn: () => listProgressEvents(orderLineItemId ?? ""),
    enabled: enabled && Boolean(orderLineItemId),
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

export function useOrderInvoiceQuery(orderId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...orderInvoicesQueryKey, orderId] as const,
    queryFn: () => getOrderInvoice(orderId ?? ""),
    enabled: enabled && Boolean(orderId),
    retry: false,
  })
}

export function useGenerateOrderInvoiceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderId: string) => generateOrderInvoice(orderId),
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey })
      await queryClient.invalidateQueries({
        queryKey: [...orderInvoicesQueryKey, invoice.order_id],
      })
    },
  })
}

function applyPriorityOrderToOrders(orders: Order[], orderIds: string[]): Order[] {
  const requestedIds = new Set(orderIds)
  const currentOrderIds = orders
    .slice()
    .sort((left, right) => {
      if (left.priority === right.priority) {
        return (
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        )
      }

      return left.priority - right.priority
    })
    .map((order) => order.id)

  let replacementIndex = 0

  const reorderedIds = currentOrderIds.map((orderId) => {
    if (!requestedIds.has(orderId)) {
      return orderId
    }

    const nextOrderId = orderIds[replacementIndex]
    replacementIndex += 1
    return nextOrderId ?? orderId
  })

  const priorityById = new Map(
    reorderedIds.map((orderId, index) => [orderId, index])
  )

  return orders.map((order) => ({
    ...order,
    priority: priorityById.get(order.id) ?? order.priority,
  }))
}
