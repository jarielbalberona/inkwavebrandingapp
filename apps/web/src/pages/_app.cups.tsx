import { createFileRoute } from "@tanstack/react-router"

import { CupsPage } from "@/features/cups/components/cups-page"

export const Route = createFileRoute("/_app/cups")({
  component: CupsPage,
})
