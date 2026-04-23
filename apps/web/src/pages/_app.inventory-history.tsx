import { createFileRoute } from "@tanstack/react-router"

import { InventoryHistoryPage } from "@/features/inventory/components/inventory-history-page"

export const Route = createFileRoute("/_app/inventory-history")({
  component: InventoryHistoryPage,
})
