import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import { CupsPage } from "@/features/cups/components/cups-page"
import { LidsPage } from "@/features/lids/components/lids-page"
import { GeneralItemsPage } from "@/features/non-stock-items/components/general-items-page"

export function ProductsPage() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">
          Manage cups, lids, and general chargeable items from one product master-data surface.
        </p>
      </div>

      <Tabs defaultValue="cups" className="grid gap-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="cups">Cups</TabsTrigger>
          <TabsTrigger value="lids">Lids</TabsTrigger>
          <TabsTrigger value="general-items">General Items</TabsTrigger>
        </TabsList>

        <TabsContent value="cups" className="mt-0">
          <CupsPage />
        </TabsContent>

        <TabsContent value="lids" className="mt-0">
          <LidsPage />
        </TabsContent>

        <TabsContent value="general-items" className="mt-0">
          <GeneralItemsPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
