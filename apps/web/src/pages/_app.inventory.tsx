import { createFileRoute } from "@tanstack/react-router"

import { InventoryPage } from "@/features/inventory/components/inventory-page"

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryPage,
})
