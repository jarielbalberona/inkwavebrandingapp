import { Link, Navigate } from "@tanstack/react-router"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { DashboardSummary } from "@/features/dashboard/api/dashboard-client"
import { useDashboardSummaryQuery } from "@/features/dashboard/hooks/use-dashboard"
import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { appPermissions, getDefaultAuthorizedRoute, hasPermission } from "@/features/auth/permissions"

export function DashboardPage() {
  const currentUser = useCurrentUser()
  const summaryQuery = useDashboardSummaryQuery()
  const canViewDashboard = hasPermission(currentUser.data, appPermissions.dashboardView)

  const summary = summaryQuery.data

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canViewDashboard) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/dashboard") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Dashboard visibility requires dashboard-view permission.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
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
        <CardContent className="grid gap-3">
          {summaryQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{summaryQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {summaryQuery.isLoading ? <DashboardSummarySkeleton /> : null}

          {summary ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
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

const METRIC_SKELETON_KEYS = ["m0", "m1", "m2", "m3"] as const
const STATUS_SKELETON_KEYS = ["s0", "s1", "s2"] as const
const NOTES_SKELETON_KEYS = ["n0", "n1", "n2", "n3"] as const

function DashboardSummarySkeleton() {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {METRIC_SKELETON_KEYS.map((id) => (
          <Card key={id} size="sm">
            <CardHeader className="gap-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card size="sm">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-full max-w-md" />
          </CardHeader>
          <CardContent className="grid gap-2">
            {STATUS_SKELETON_KEYS.map((id) => (
              <Skeleton key={id} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-full" />
          </CardHeader>
          <CardContent className="grid gap-2">
            {NOTES_SKELETON_KEYS.map((id) => (
              <Skeleton key={id} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
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
    <Card size="sm">
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
    <Card>
      <CardHeader>
        <CardTitle>Order Statuses</CardTitle>
        <CardDescription>
          Derived from the current fulfillment model, including partial releases.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <ItemGroup>
          {summary.orders.statuses.map((item) => (
            <Item key={item.status} variant="outline" size="sm" className="items-center">
              <ItemContent>
                <span className="text-sm font-medium leading-tight text-foreground">
                  {formatStatus(item.status)}
                </span>
                <ItemDescription>{statusDescription(item.status)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant={statusBadgeVariant(item.status)}>{item.count.toLocaleString()}</Badge>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>

        <Item variant="muted" size="sm" className="text-sm text-muted-foreground">
          <ItemContent>
            <p>
              Total orders tracked:{" "}
              <span className="font-medium text-foreground">
                {summary.orders.total_orders.toLocaleString()}
              </span>
            </p>
          </ItemContent>
        </Item>
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
    <Card>
      <CardHeader>
        <CardTitle>Operational Notes</CardTitle>
        <CardDescription>Quick summary derived from backend-safe counts only.</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {attentionItems.map((item) => (
            <Item key={item} variant="outline" size="sm">
              <ItemContent>
                <ItemDescription className="text-balance text-muted-foreground">{item}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
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
