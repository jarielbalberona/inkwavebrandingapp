import { createFileRoute } from "@tanstack/react-router"

import { AppShell } from "@/app/components/app-shell"

export const Route = createFileRoute("/_app")({
  component: AppShell,
})
