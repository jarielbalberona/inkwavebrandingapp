import { Outlet, createRootRoute } from "@tanstack/react-router"

import { NotFoundPage } from "@/app/components/not-found-page"

export const Route = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFoundPage,
})
