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

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import type {
  CupUsageReport,
  CupUsageReportItem,
  InventoryReportItem,
  OrderStatusReport,
  OrderStatusReportItem,
  SalesCostReport,
  SalesCostReportItem,
} from "@/features/reports/api/reports-client"
import {
  useCupUsageReportQuery,
  useInventorySummaryReportQuery,
  useLowStockReportQuery,
  useOrderStatusReportQuery,
  useSalesCostReportQuery,
} from "@/features/reports/hooks/use-reports"

type ReportTab =
  | "inventory-summary"
  | "low-stock"
  | "order-status"
  | "cup-usage"
  | "sales-cost"

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("inventory-summary")
  const currentUser = useCurrentUser()
  const isAdmin = currentUser.data?.role === "admin"
  const inventorySummaryQuery = useInventorySummaryReportQuery()
  const lowStockQuery = useLowStockReportQuery()
  const orderStatusQuery = useOrderStatusReportQuery()
  const cupUsageQuery = useCupUsageReportQuery()
  const salesCostQuery = useSalesCostReportQuery(isAdmin)

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
        : activeTab === "order-status"
          ? orderStatusQuery
          : activeTab === "cup-usage"
            ? cupUsageQuery
            : salesCostQuery

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>
            Inventory summary now reflects tracked cups and lids. Low-stock remains cup-threshold
            only because lids do not have reorder thresholds in schema. Usage and financial views
            remain explicitly cup-based.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (
                value === "inventory-summary" ||
                value === "low-stock" ||
                value === "order-status" ||
                value === "cup-usage" ||
                value === "sales-cost"
              ) {
                setActiveTab(value)
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="inventory-summary">Inventory Summary</TabsTrigger>
              <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
              <TabsTrigger value="order-status">Order Status</TabsTrigger>
              <TabsTrigger value="cup-usage">Cup Usage</TabsTrigger>
              <TabsTrigger value="sales-cost">Sales & Cost</TabsTrigger>
            </TabsList>
          </Tabs>

          {activeTab === "order-status" ? (
            <OrderStatusReportSection report={orderStatusQuery.data} />
          ) : activeTab === "cup-usage" ? (
            <CupUsageReportSection report={cupUsageQuery.data} />
          ) : activeTab === "sales-cost" ? (
            <SalesCostReportSection isAdmin={isAdmin} report={salesCostQuery.data} />
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

          {!activeQuery.isLoading &&
          activeTab !== "order-status" &&
          activeTab !== "cup-usage" &&
          activeTab !== "sales-cost" &&
          inventoryReport?.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {activeTab === "inventory-summary"
                ? "No inventory report rows available yet."
                : "No low-stock cup rows right now."}
            </p>
          ) : null}

          {!activeQuery.isLoading &&
          activeTab === "order-status" &&
          orderStatusQuery.data?.statuses.every((item) => item.count === 0) ? (
            <p className="text-sm text-muted-foreground">No orders recorded yet.</p>
          ) : null}

          {!activeQuery.isLoading &&
          activeTab === "cup-usage" &&
          cupUsageQuery.data?.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No consume movements recorded yet.</p>
          ) : null}

          {!activeQuery.isLoading &&
          activeTab === "sales-cost" &&
          isAdmin &&
          salesCostQuery.data?.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No released quantity has been recorded for financial reporting yet.
            </p>
          ) : null}

          {activeTab !== "order-status" &&
          activeTab !== "cup-usage" &&
          activeTab !== "sales-cost" &&
          inventoryReport?.items.length ? (
            <InventoryReportTable items={inventoryReport.items} />
          ) : null}

          {activeTab === "cup-usage" && cupUsageQuery.data?.items.length ? (
            <CupUsageReportTable items={cupUsageQuery.data.items} />
          ) : null}

          {activeTab === "sales-cost" && isAdmin && salesCostQuery.data?.items.length ? (
            <SalesCostReportTable items={salesCostQuery.data.items} />
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
        description={
          activeTab === "inventory-summary"
            ? "Tracked cups and lids in inventory summary"
            : "Cup rows below available-vs-min-stock threshold"
        }
      />
      <MetricCard
        label="Total available"
        value={sum(items, (item) => item.available)}
        description="Available = on hand - reserved"
      />
      <MetricCard
        label="Inactive rows"
        value={sum(items, (item) => (item.item.is_active ? 0 : 1))}
        description="Inactive rows still shown if data exists"
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
    <Card>
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

function MoneyMetricCard({
  description,
  label,
  value,
}: {
  description: string
  label: string
  value: string
}) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
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
          <TableHead>Item</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Size / Shape</TableHead>
          <TableHead>Diameter</TableHead>
          <TableHead>On hand</TableHead>
          <TableHead>Reserved</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Min stock</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.item.id}>
            <TableCell className="font-medium">{item.item.sku}</TableCell>
            <TableCell className="capitalize">{item.item_type}</TableCell>
            <TableCell>{item.item.type}</TableCell>
            <TableCell>{item.item.brand}</TableCell>
            <TableCell>{item.item.size_or_shape}</TableCell>
            <TableCell>{item.item.diameter}</TableCell>
            <TableCell>{item.on_hand.toLocaleString()}</TableCell>
            <TableCell>{item.reserved.toLocaleString()}</TableCell>
            <TableCell>
              <span className={item.available < 0 ? "text-destructive" : undefined}>
                {item.available.toLocaleString()}
              </span>
            </TableCell>
            <TableCell>
              {item.item.min_stock === null ? (
                <span className="text-muted-foreground">No threshold</span>
              ) : (
                item.item.min_stock.toLocaleString()
              )}
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Badge
                  variant={
                    item.item_type === "cup" && item.is_low_stock ? "destructive" : "outline"
                  }
                >
                  {item.item_type === "cup"
                    ? item.is_low_stock
                      ? "Low stock"
                      : "Healthy"
                    : "No threshold"}
                </Badge>
                <Badge variant={item.item.is_active ? "default" : "secondary"}>
                  {item.item.is_active ? "Active" : "Inactive"}
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
        <Card>
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

function CupUsageReportSection({ report }: { report: CupUsageReport | undefined }) {
  const sortedItems = [...(report?.items ?? [])].sort(
    (left, right) => right.consumed_quantity - left.consumed_quantity,
  )

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Tracked SKUs"
          value={sortedItems.length}
          description="Cup-only usage surface based on inventory consumption movements"
        />
        <MetricCard
          label="Total consumed"
          value={report?.total_consumed_quantity ?? 0}
          description="Cup consume and order-linked adjustment quantities"
        />
        <MetricCard
          label="Inactive SKUs"
          value={sumCupUsage(sortedItems, (item) => (item.cup.is_active ? 0 : 1))}
          description="Inactive cups still counted if used historically"
        />
      </div>

      {report ? (
        <Card>
          <CardHeader>
            <CardDescription>Filter basis</CardDescription>
            <CardTitle className="text-lg">
              {report.filters.start_date || report.filters.end_date
                ? "Filtered date range"
                : "All recorded consume movements"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Start: {report.filters.start_date ?? "Not set"} • End:{" "}
              {report.filters.end_date ?? "Not set"}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function SalesCostReportSection({
  isAdmin,
  report,
}: {
  isAdmin: boolean
  report: SalesCostReport | undefined
}) {
  if (!isAdmin) {
    return (
      <Alert>
        <AlertDescription>
          Sales and cost reporting is admin-only. This page does not request or render financial
          data for staff users.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Released quantity"
          value={report?.totals.released_quantity ?? 0}
          description="Cup-only released quantity basis from backend"
        />
        <MoneyMetricCard
          label="Sell total"
          value={report?.totals.sell_total ?? "0.00"}
          description="Cup-only released sell value"
        />
        <MoneyMetricCard
          label="Cost total"
          value={report?.totals.cost_total ?? "0.00"}
          description="Cup-only released cost value"
        />
        <MoneyMetricCard
          label="Gross profit"
          value={report?.totals.gross_profit ?? "0.00"}
          description="Cup-only released-basis profit visibility"
        />
      </div>

      {report ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Financial Basis</CardTitle>
            <CardDescription>
              Quantity basis: {report.quantity_basis}. Date basis: {report.date_basis}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Start: {report.filters.start_date ?? "Not set"} • End:{" "}
              {report.filters.end_date ?? "Not set"}
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

function sumCupUsage(items: CupUsageReportItem[], mapItem: (item: CupUsageReportItem) => number) {
  return items.reduce((total, item) => total + mapItem(item), 0)
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

function CupUsageReportTable({ items }: { items: CupUsageReportItem[] }) {
  const sortedItems = [...items].sort((left, right) => right.consumed_quantity - left.consumed_quantity)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Diameter</TableHead>
          <TableHead>Consumed Quantity</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedItems.map((item) => (
          <TableRow key={item.cup.id}>
            <TableCell className="font-medium">{item.cup.sku}</TableCell>
            <TableCell>{item.cup.type}</TableCell>
            <TableCell>{item.cup.brand}</TableCell>
            <TableCell>{item.cup.size}</TableCell>
            <TableCell>{item.cup.diameter}</TableCell>
            <TableCell>{item.consumed_quantity.toLocaleString()}</TableCell>
            <TableCell>
              <Badge variant={item.cup.is_active ? "default" : "secondary"}>
                {item.cup.is_active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SalesCostReportTable({ items }: { items: SalesCostReportItem[] }) {
  const sortedItems = [...items].sort(
    (left, right) => Number(right.sell_total) - Number(left.sell_total),
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Released Quantity</TableHead>
          <TableHead>Sell Total</TableHead>
          <TableHead>Cost Total</TableHead>
          <TableHead>Gross Profit</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedItems.map((item) => (
          <TableRow key={item.cup.id}>
            <TableCell className="font-medium">{item.cup.sku}</TableCell>
            <TableCell>{item.cup.brand}</TableCell>
            <TableCell>{item.released_quantity.toLocaleString()}</TableCell>
            <TableCell>{item.sell_total}</TableCell>
            <TableCell>{item.cost_total}</TableCell>
            <TableCell>{item.gross_profit}</TableCell>
            <TableCell>
              <Badge variant={item.cup.is_active ? "default" : "secondary"}>
                {item.cup.is_active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
