import { createFileRoute } from "@tanstack/react-router"

import { GeneralItemsPage } from "@/features/non-stock-items/components/general-items-page"

export const Route = createFileRoute("/_app/general-items")({
  component: GeneralItemsPage,
})
