export function InventoryPage() {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Stock control
        </p>
        <h1 className="text-3xl font-semibold">Inventory</h1>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">
          Placeholder for ledger-backed stock intake, balances, reservations,
          and movement history. No inventory logic is implemented yet.
        </p>
      </div>
    </section>
  )
}
