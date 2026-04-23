import { createFileRoute } from "@tanstack/react-router"

import { HomePage } from "@/features/dashboard/components/home-page"

export const Route = createFileRoute("/")({
  component: HomePage,
})
