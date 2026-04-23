import {
  BookOpenTextIcon,
  BoxIcon,
  LayoutDashboardIcon,
  LogInIcon,
  PackageSearchIcon,
  ShoppingCartIcon,
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
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"

const operationsItems = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Cups", to: "/cups", icon: BoxIcon },
  { title: "Inventory", to: "/inventory", icon: PackageSearchIcon },
  { title: "Orders", to: "/orders", icon: ShoppingCartIcon },
  { title: "Reports", to: "/reports", icon: BookOpenTextIcon },
] as const

const supportItems = [
  { title: "Login", to: "/login", icon: LogInIcon },
] as const

export function AppSidebar() {
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
                <span className="truncate text-xs">Cup operations</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Operations" items={operationsItems} />
        <NavSecondary items={supportItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: "Internal User",
            email: "auth not wired",
            fallback: "IW",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
