import { createFileRoute } from "@tanstack/react-router"

import { OrderViewPage } from "@/features/orders/components/order-view-page"

export const Route = createFileRoute("/_app/orders/$orderId/")({
  component: OrderViewRoute,
})

function OrderViewRoute() {
  const { orderId } = Route.useParams()

  return <OrderViewPage orderId={orderId} />
}
