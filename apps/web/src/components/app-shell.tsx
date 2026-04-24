import { Navigate, Outlet } from "@tanstack/react-router"

import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useCurrentUser } from "@/features/auth/hooks/use-auth"

export function AppShell() {
  const currentUser = useCurrentUser()

  if (currentUser.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-sm text-muted-foreground">
        Checking session...
      </main>
    )
  }

  if (!currentUser.data) {
    return <Navigate to="/login" />
  }

  return (
    <SidebarProvider
      className="min-h-screen"
      style={
        {
          "--header-height": "3.5rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={currentUser.data} />
      <SidebarInset className="@container/main">
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-3 p-3 lg:p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
