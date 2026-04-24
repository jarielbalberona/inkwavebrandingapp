import { createFileRoute } from "@tanstack/react-router"

import { OrderFulfillmentPage } from "@/features/orders/components/order-fulfillment-page"

export const Route = createFileRoute("/_app/orders/$orderId/fulfillment")({
  component: OrderFulfillmentRoute,
})

function OrderFulfillmentRoute() {
  const { orderId } = Route.useParams()

  return <OrderFulfillmentPage orderId={orderId} />
}
