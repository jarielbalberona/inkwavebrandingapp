import { useState } from "react"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import type {
  InventoryReportItem,
  OrderStatusReport,
  OrderStatusReportItem,
} from "@/features/reports/api/reports-client"
import {
  useInventorySummaryReportQuery,
  useLowStockReportQuery,
  useOrderStatusReportQuery,
} from "@/features/reports/hooks/use-reports"

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"inventory-summary" | "low-stock" | "order-status">(
    "inventory-summary",
  )
  const inventorySummaryQuery = useInventorySummaryReportQuery()
  const lowStockQuery = useLowStockReportQuery()
  const orderStatusQuery = useOrderStatusReportQuery()
  const inventoryReport =
    activeTab === "inventory-summary"
      ? inventorySummaryQuery.data
      : activeTab === "low-stock"
        ? lowStockQuery.data
        : undefined
  const activeQuery =
    activeTab === "inventory-summary"
      ? inventorySummaryQuery
      : activeTab === "low-stock"
        ? lowStockQuery
        : orderStatusQuery

  return (
    <div className="grid gap-4">
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>
            Inventory and order reporting now come from backend source data. No stale
            <span className="mx-1 font-medium text-foreground">printing</span>
            status is shown anywhere in this screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (
                value === "inventory-summary" ||
                value === "low-stock" ||
                value === "order-status"
              ) {
                setActiveTab(value)
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="inventory-summary">Inventory Summary</TabsTrigger>
              <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
              <TabsTrigger value="order-status">Order Status</TabsTrigger>
            </TabsList>
          </Tabs>

          {activeTab === "order-status" ? (
            <OrderStatusReportSection report={orderStatusQuery.data} />
          ) : (
            <InventoryReportSummaryCards
              activeTab={activeTab}
              items={
                activeTab === "inventory-summary"
                  ? inventorySummaryQuery.data?.items
                  : lowStockQuery.data?.items
              }
            />
          )}

          {activeQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{activeQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {activeQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading report data...</p>
          ) : null}

          {!activeQuery.isLoading && activeTab !== "order-status" && inventoryReport?.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {activeTab === "inventory-summary"
                ? "No inventory report rows available yet."
                : "No low-stock rows right now."}
            </p>
          ) : null}

          {!activeQuery.isLoading &&
          activeTab === "order-status" &&
          orderStatusQuery.data?.statuses.every((item) => item.count === 0) ? (
            <p className="text-sm text-muted-foreground">No orders recorded yet.</p>
          ) : null}

          {activeTab !== "order-status" && inventoryReport?.items.length ? (
            <InventoryReportTable items={inventoryReport.items} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function InventoryReportSummaryCards({
  activeTab,
  items,
}: {
  activeTab: "inventory-summary" | "low-stock"
  items: InventoryReportItem[] | undefined
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard
        label="Visible rows"
        value={items?.length ?? 0}
        description={activeTab === "inventory-summary" ? "All cups in summary" : "Low-stock rows"}
      />
      <MetricCard
        label="Total available"
        value={sum(items, (item) => item.available)}
        description="Available = on hand - reserved"
      />
      <MetricCard
        label="Inactive rows"
        value={sum(items, (item) => (item.cup.is_active ? 0 : 1))}
        description="Inactive cups still shown if data exists"
      />
    </div>
  )
}

function MetricCard({
  description,
  label,
  value,
}: {
  description: string
  label: string
  value: number
}) {
  return (
    <Card className="rounded-none">
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value.toLocaleString()}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function InventoryReportTable({ items }: { items: InventoryReportItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Dimension</TableHead>
          <TableHead>On hand</TableHead>
          <TableHead>Reserved</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Min stock</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.cup.id}>
            <TableCell className="font-medium">{item.cup.sku}</TableCell>
            <TableCell>{item.cup.brand}</TableCell>
            <TableCell>{item.cup.size}</TableCell>
            <TableCell>{item.cup.dimension}</TableCell>
            <TableCell>{item.on_hand.toLocaleString()}</TableCell>
            <TableCell>{item.reserved.toLocaleString()}</TableCell>
            <TableCell>
              <span className={item.available < 0 ? "text-destructive" : undefined}>
                {item.available.toLocaleString()}
              </span>
            </TableCell>
            <TableCell>{item.cup.min_stock.toLocaleString()}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Badge variant={item.is_low_stock ? "destructive" : "outline"}>
                  {item.is_low_stock ? "Low stock" : "Healthy"}
                </Badge>
                <Badge variant={item.cup.is_active ? "default" : "secondary"}>
                  {item.cup.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function OrderStatusReportSection({ report }: { report: OrderStatusReport | undefined }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {report?.statuses.map((item) => (
          <MetricCard
            key={item.status}
            label={formatStatus(item.status)}
            value={item.count}
            description={statusDescription(item)}
          />
        )) ?? null}
      </div>

      {report ? (
        <Card className="rounded-none">
          <CardHeader>
            <CardDescription>Total orders tracked</CardDescription>
            <CardTitle className="text-2xl">{report.total_orders.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {report.statuses.map((item) => (
                <Badge key={item.status} variant={statusBadgeVariant(item.status)}>
                  {formatStatus(item.status)}: {item.count.toLocaleString()}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              `partial_released` remains distinct from `completed` so partial fulfillment does not
              get flattened into a false done state.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function sum(items: InventoryReportItem[] | undefined, mapItem: (item: InventoryReportItem) => number) {
  return (items ?? []).reduce((total, item) => total + mapItem(item), 0)
}

function formatStatus(status: OrderStatusReportItem["status"]) {
  switch (status) {
    case "in_progress":
      return "In Progress"
    case "partial_released":
      return "Partial Released"
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

function statusBadgeVariant(status: OrderStatusReportItem["status"]) {
  switch (status) {
    case "completed":
      return "default"
    case "partial_released":
      return "secondary"
    case "canceled":
      return "destructive"
    default:
      return "outline"
  }
}

function statusDescription(item: OrderStatusReportItem) {
  switch (item.status) {
    case "pending":
      return "Reserved, no fulfillment activity yet"
    case "in_progress":
      return "Production activity exists, nothing released yet"
    case "partial_released":
      return "Some quantity released, not fully done"
    case "completed":
      return "All ordered quantity released"
    case "canceled":
      return "Order lifecycle closed"
  }
}
