import { createFileRoute } from "@tanstack/react-router"

import { ReportsPage } from "@/features/reports/components/reports-page"

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
})
