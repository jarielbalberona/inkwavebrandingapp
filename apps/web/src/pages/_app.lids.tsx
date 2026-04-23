import { createFileRoute } from "@tanstack/react-router"

import { LidsPage } from "@/features/lids/components/lids-page"

export const Route = createFileRoute("/_app/lids")({
  component: LidsPage,
})
