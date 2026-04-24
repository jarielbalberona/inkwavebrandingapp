import { createFileRoute } from "@tanstack/react-router"

import { ProductsPage } from "@/features/products/components/products-page"

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
})
