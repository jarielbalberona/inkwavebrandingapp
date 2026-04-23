import { createFileRoute } from "@tanstack/react-router"

import { OrderCreatePage } from "@/features/orders/components/order-create-page"

export const Route = createFileRoute("/_app/orders/new")({
  component: OrderCreatePage,
})
