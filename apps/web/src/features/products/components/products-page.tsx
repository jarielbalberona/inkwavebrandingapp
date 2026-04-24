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

export function ProductsPage() {
  const currentUser = useCurrentUser()
  const productTabs = useMemo(
    (): Array<{ value: string; label: string; content: ReactNode }> => {
      const tabs: Array<{ value: string; label: string; content: ReactNode }> = []

      if (hasPermission(currentUser.data, appPermissions.cupsView)) {
        tabs.push({ value: "cups", label: "Cups", content: <CupsPage /> })
      }

      if (hasPermission(currentUser.data, appPermissions.lidsView)) {
        tabs.push({ value: "lids", label: "Lids", content: <LidsPage /> })
      }

      if (hasPermission(currentUser.data, appPermissions.nonStockItemsView)) {
        tabs.push({ value: "general-items", label: "General", content: <GeneralItemsPage /> })
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
          Manage cups, lids, and general chargeable items from one product master-data surface.
        </p>
      </div>

      <Tabs defaultValue={defaultTab.value} className="grid gap-4">
        <TabsList className="w-full justify-start">
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
