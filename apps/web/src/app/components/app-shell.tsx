import { Link, Outlet } from "@tanstack/react-router"

const navigationItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/cups", label: "Cups" },
  { to: "/inventory", label: "Inventory" },
  { to: "/orders", label: "Orders" },
  { to: "/reports", label: "Reports" },
  { to: "/design-system", label: "Design System" },
] as const

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <Link to="/" className="text-base font-semibold">
              Ink Wave Branding
            </Link>
            <p className="text-sm text-muted-foreground">
              Internal cup printing operations
            </p>
          </div>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-2">
            {navigationItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{
                  className: "bg-primary text-primary-foreground",
                }}
                inactiveProps={{
                  className:
                    "text-muted-foreground hover:bg-muted hover:text-foreground",
                }}
                className="rounded-md px-3 py-2 text-sm font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
