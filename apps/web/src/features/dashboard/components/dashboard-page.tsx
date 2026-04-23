export function DashboardPage() {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Internal operations
        </p>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">
          Placeholder for operational summaries. Reporting and dashboard data
          will be added after auth, catalog, inventory, and orders are real.
        </p>
      </div>
    </section>
  )
}
