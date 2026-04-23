import { createFileRoute } from "@tanstack/react-router"

import { OrdersPage } from "@/features/orders/components/orders-page"

export const Route = createFileRoute("/_app/orders/")({
  component: OrdersPage,
})
