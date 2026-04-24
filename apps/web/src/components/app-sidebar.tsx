import {
  BookOpenTextIcon,
  BoxIcon,
  Disc3Icon,
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

export function AppSidebar({ user }: { user: AuthenticatedUser }) {
  const displayName = user.displayName ?? user.email
  const operationsItems = [
    { title: "Dashboard", to: "/dashboard", icon: LayoutDashboardIcon },
    { title: "Cups", to: "/cups", icon: BoxIcon },
    { title: "Lids", to: "/lids", icon: Disc3Icon },
    { title: "Customers", to: "/customers", icon: UsersRoundIcon },
    { title: "Inventory", to: "/inventory", icon: PackageSearchIcon },
    { title: "Orders", to: "/orders", icon: ShoppingCartIcon },
    ...(user.role === "admin"
      ? [{ title: "Invoices", to: "/invoices", icon: FileTextIcon }]
      : []),
    { title: "Reports", to: "/reports", icon: BookOpenTextIcon },
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
