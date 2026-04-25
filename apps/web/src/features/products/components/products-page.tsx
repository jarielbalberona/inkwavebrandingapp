import { useMemo, type ReactNode } from "react"

import { Navigate } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import {
  appPermissions,
  getDefaultAuthorizedRoute,
  hasPermission,
} from "@/features/auth/permissions"
import { CupsPage } from "@/features/cups/components/cups-page"
import { LidsPage } from "@/features/lids/components/lids-page"
import { GeneralItemsPage } from "@/features/non-stock-items/components/general-items-page"
import { ProductBundlesPage } from "@/features/product-bundles/components/product-bundles-page"

type ProductTabValue = "cups" | "lids" | "general-items" | "bundles" | "pricing-rules"

type ProductTab = {
  value: ProductTabValue
  label: string
  content: ReactNode
}

export function ProductsPage() {
  const currentUser = useCurrentUser()
  const productTabs = useMemo(
    (): ProductTab[] => {
      const tabs: ProductTab[] = []

      // Keep the Products surface as one compact tab row:
      // inventory master data first, commercial bundle/pricing tabs after they land.
      if (hasPermission(currentUser.data, appPermissions.cupsView)) {
        tabs.push({ value: "cups", label: "Cups", content: <CupsPage /> })
      }

      if (hasPermission(currentUser.data, appPermissions.lidsView)) {
        tabs.push({ value: "lids", label: "Lids", content: <LidsPage /> })
      }

      if (hasPermission(currentUser.data, appPermissions.nonStockItemsView)) {
        tabs.push({ value: "general-items", label: "General", content: <GeneralItemsPage /> })
      }

      if (hasPermission(currentUser.data, appPermissions.productBundlesView)) {
        tabs.push({ value: "bundles", label: "Bundles", content: <ProductBundlesPage /> })
      }

      return tabs
    },
    [currentUser.data],
  )
  const defaultTab = productTabs[0]

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!defaultTab) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/products") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Product visibility requires at least one product-view permission.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">
          Manage inventory master data and commercial selling setup from one product surface.
        </p>
      </div>

      <Tabs defaultValue={defaultTab.value} className="grid gap-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          {productTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {productTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
