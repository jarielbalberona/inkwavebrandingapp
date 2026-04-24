import { useMatches } from "@tanstack/react-router"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"

import { ThemeSwitcher } from "@/components/theme-switcher"

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/cups": "Cups",
  "/general-items": "General Items",
  "/inventory": "Inventory",
  "/inventory-history": "Inventory History",
  "/orders": "Orders",
  "/products": "Products",
  "/reports": "Reports",
  "/design-system": "Design System",
}

export function SiteHeader() {
  const matches = useMatches()
  const currentMatch = matches.at(-1)
  const title = routeTitles[currentMatch?.pathname ?? ""] ?? "Ink Wave Branding"

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-3 lg:gap-2 lg:px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto">
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  )
}
