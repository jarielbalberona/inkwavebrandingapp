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

import type { InventoryReportItem } from "@/features/reports/api/reports-client"
import {
  useInventorySummaryReportQuery,
  useLowStockReportQuery,
} from "@/features/reports/hooks/use-reports"

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"inventory-summary" | "low-stock">(
    "inventory-summary",
  )
  const inventorySummaryQuery = useInventorySummaryReportQuery()
  const lowStockQuery = useLowStockReportQuery()
  const activeQuery = activeTab === "inventory-summary" ? inventorySummaryQuery : lowStockQuery
  const report = activeQuery.data

  return (
    <div className="grid gap-4">
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>
            Inventory reporting is live from backend source data. Low-stock uses available stock as
            its basis.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (value === "inventory-summary" || value === "low-stock") {
                setActiveTab(value)
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="inventory-summary">Inventory Summary</TabsTrigger>
              <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Visible rows"
              value={report?.items.length ?? 0}
              description={activeTab === "inventory-summary" ? "All cups in summary" : "Low-stock rows"}
            />
            <MetricCard
              label="Total available"
              value={sum(report?.items, (item) => item.available)}
              description="Available = on hand - reserved"
            />
            <MetricCard
              label="Inactive rows"
              value={sum(report?.items, (item) => (item.cup.is_active ? 0 : 1))}
              description="Inactive cups still shown if data exists"
            />
          </div>

          {activeQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{activeQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {activeQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading report data...</p>
          ) : null}

          {!activeQuery.isLoading && report?.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {activeTab === "inventory-summary"
                ? "No inventory report rows available yet."
                : "No low-stock rows right now."}
            </p>
          ) : null}

          {report?.items.length ? <InventoryReportTable items={report.items} /> : null}
        </CardContent>
      </Card>
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

function sum(items: InventoryReportItem[] | undefined, mapItem: (item: InventoryReportItem) => number) {
  return (items ?? []).reduce((total, item) => total + mapItem(item), 0)
}
