import { createFileRoute } from "@tanstack/react-router"

import { OrderEditPage } from "@/features/orders/components/order-edit-page"

export const Route = createFileRoute("/_app/orders/$orderId/edit")({
  component: OrderEditRoute,
})

function OrderEditRoute() {
  const { orderId } = Route.useParams()

  return <OrderEditPage orderId={orderId} />
}
