export function OrdersPage() {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Production workflow
        </p>
        <h1 className="text-3xl font-semibold">Orders</h1>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">
          Placeholder for order creation, lifecycle status, and future stock
          reservation/consumption flows. No order logic is implemented yet.
        </p>
      </div>
    </section>
  )
}
