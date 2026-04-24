import { Link } from "@tanstack/react-router"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import type { DashboardSummary } from "@/features/dashboard/api/dashboard-client"
import { useDashboardSummaryQuery } from "@/features/dashboard/hooks/use-dashboard"

export function DashboardPage() {
  const summaryQuery = useDashboardSummaryQuery()

  const summary = summaryQuery.data

  return (
    <div className="grid gap-4">
      <Card className="rounded-none">
        <CardHeader className="gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <CardTitle>Dashboard</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/inventory">Inventory</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/orders">Orders</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/reports">Reports</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {summaryQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{summaryQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {summaryQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading dashboard summary...</p>
          ) : null}

          {summary ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Tracked items"
                  value={summary.inventory.tracked_items}
                  description={`Inventory-tracked cups and lids. Cups: ${summary.inventory.tracked_cup_count.toLocaleString()} • Lids: ${summary.inventory.tracked_lid_count.toLocaleString()}.`}
                />
                <MetricCard
                  label="Low-stock cups"
                  value={summary.inventory.low_stock_cup_count}
                  description="Cup threshold only. Lids do not have reorder thresholds in schema yet."
                  tone={summary.inventory.low_stock_cup_count > 0 ? "destructive" : "default"}
                />
                <MetricCard
                  label="Pending orders"
                  value={summary.orders.pending_count}
                  description="Orders holding reservation without production activity yet."
                />
                <MetricCard
                  label="Partial released"
                  value={summary.orders.partial_released_count}
                  description="Orders with some released quantity but not fully completed."
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <OrderStatusCard summary={summary} />
                <OperationalNotesCard summary={summary} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  description,
  label,
  tone = "default",
  value,
}: {
  description: string
  label: string
  tone?: "default" | "destructive"
  value: number
}) {
  return (
    <Card className="rounded-none">
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={tone === "destructive" ? "text-2xl text-destructive" : "text-2xl"}>
          {value.toLocaleString()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function OrderStatusCard({ summary }: { summary: DashboardSummary }) {
  return (
    <Card className="rounded-none">
      <CardHeader>
        <CardTitle>Order Statuses</CardTitle>
        <CardDescription>
          Derived from the current fulfillment model, including partial releases.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary.orders.statuses.map((item) => (
            <div key={item.status} className="flex items-center justify-between border p-3">
              <div className="grid gap-1">
                <span className="text-sm font-medium">{formatStatus(item.status)}</span>
                <span className="text-xs text-muted-foreground">{statusDescription(item.status)}</span>
              </div>
              <Badge variant={statusBadgeVariant(item.status)}>{item.count.toLocaleString()}</Badge>
            </div>
          ))}
        </div>

        <div className="border p-3 text-sm text-muted-foreground">
          Total orders tracked:{" "}
          <span className="font-medium text-foreground">
            {summary.orders.total_orders.toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function OperationalNotesCard({ summary }: { summary: DashboardSummary }) {
  const attentionItems = [
    summary.inventory.low_stock_cup_count > 0
      ? `${summary.inventory.low_stock_cup_count.toLocaleString()} low-stock cup records need attention.`
      : "No low-stock cup records right now.",
    `${summary.inventory.tracked_lid_count.toLocaleString()} lid SKUs are tracked in inventory, but lids still have no low-stock threshold model.`,
    summary.orders.partial_released_count > 0
      ? `${summary.orders.partial_released_count.toLocaleString()} orders are partially released and still open.`
      : "No partially released orders right now.",
    summary.orders.pending_count > 0
      ? `${summary.orders.pending_count.toLocaleString()} orders are still pending production start.`
      : "No pending orders waiting for production start.",
  ]

  return (
    <Card className="rounded-none">
      <CardHeader>
        <CardTitle>Operational Notes</CardTitle>
        <CardDescription>
          Quick summary derived from backend-safe counts only.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {attentionItems.map((item) => (
          <div key={item} className="border p-3 text-muted-foreground">
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function formatStatus(status: DashboardSummary["orders"]["statuses"][number]["status"]) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

function statusDescription(status: DashboardSummary["orders"]["statuses"][number]["status"]) {
  switch (status) {
    case "pending":
      return "Reserved but no production progress yet."
    case "in_progress":
      return "Production has started but nothing is released yet."
    case "partial_released":
      return "Some quantity is released, but the order is still open."
    case "completed":
      return "All line items have reached full released quantity."
    case "canceled":
      return "Order was canceled and operationally closed."
  }
}

function statusBadgeVariant(status: DashboardSummary["orders"]["statuses"][number]["status"]) {
  switch (status) {
    case "completed":
      return "default"
    case "canceled":
      return "secondary"
    case "partial_released":
      return "outline"
    case "in_progress":
      return "outline"
    case "pending":
      return "secondary"
  }
}
