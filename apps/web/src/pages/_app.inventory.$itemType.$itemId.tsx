import { createFileRoute } from "@tanstack/react-router"

import { InventoryItemDetailPage } from "@/features/inventory/components/inventory-item-detail-page"

export const Route = createFileRoute("/_app/inventory/$itemType/$itemId")({
  component: InventoryItemDetailRoute,
})

function InventoryItemDetailRoute() {
  const { itemType, itemId } = Route.useParams()

  return <InventoryItemDetailPage itemType={itemType} itemId={itemId} />
}
