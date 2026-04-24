import {
  BookOpenTextIcon,
  BoxIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  PackageSearchIcon,
  ShoppingCartIcon,
  UsersRoundIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import type { AuthenticatedUser } from "@/features/auth/api/auth-client"
import { appPermissions, canViewProducts, hasPermission } from "@/features/auth/permissions"

export function AppSidebar({ user }: { user: AuthenticatedUser }) {
  const displayName = user.displayName ?? user.email
  const operationsItems = [
    ...(hasPermission(user, appPermissions.dashboardView)
      ? [{ title: "Dashboard", to: "/dashboard", icon: LayoutDashboardIcon }]
      : []),
    ...(canViewProducts(user)
      ? [{ title: "Products", to: "/products", icon: BoxIcon }]
      : []),
    ...(hasPermission(user, appPermissions.customersView)
      ? [{ title: "Customers", to: "/customers", icon: UsersRoundIcon }]
      : []),
    ...(hasPermission(user, appPermissions.inventoryView)
      ? [{ title: "Inventory", to: "/inventory", icon: PackageSearchIcon }]
      : []),
    ...(hasPermission(user, appPermissions.ordersView)
      ? [{ title: "Orders", to: "/orders", icon: ShoppingCartIcon }]
      : []),
    ...(hasPermission(user, appPermissions.invoicesView)
      ? [{ title: "Invoices", to: "/invoices", icon: FileTextIcon }]
      : []),
    ...(hasPermission(user, appPermissions.usersManage)
      ? [{ title: "Users", to: "/users", icon: UsersRoundIcon }]
      : []),
    ...(hasPermission(user, appPermissions.reportsView)
      ? [{ title: "Reports", to: "/reports", icon: BookOpenTextIcon }]
      : []),
  ] as const

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground">
                IW
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Ink Wave Branding</span>
                <span className="truncate text-xs">Production Internal</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Operations" items={operationsItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: displayName,
            email: user.email,
            fallback: buildFallback(displayName),
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function buildFallback(value: string) {
  return value
    .split(/[^\da-z]+/i)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "IW"
}
