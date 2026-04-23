import { useQuery } from "@tanstack/react-query"

import {
  listOrders,
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
