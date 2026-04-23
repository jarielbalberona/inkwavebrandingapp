import { useMemo, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import type { Order, OrderStatus } from "@/features/orders/api/orders-client"
import {
  orderStatusOptions,
  useOrdersQuery,
} from "@/features/orders/hooks/use-orders"

export function OrdersPage() {
  const [status, setStatus] = useState<OrderStatus | "all">("all")
  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
    }),
    [status],
  )
  const ordersQuery = useOrdersQuery(query)

  return (
    <Card className="rounded-none">
      <CardHeader className="gap-4">
        <div className="grid gap-1">
          <CardTitle>Orders</CardTitle>
          <CardDescription>
            Derived fulfillment status from production progress. No stale printing status, no client-side
            financial redaction.
          </CardDescription>
        </div>

        <div className="grid gap-2 md:max-w-xs">
          <Label>Fulfillment status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus | "all")}>
            <SelectTrigger className="w-full rounded-none">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all">All statuses</SelectItem>
              {orderStatusOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {formatStatus(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        {ordersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        ) : null}

        {ordersQuery.isError ? (
          <p className="text-sm text-destructive">{ordersQuery.error.message}</p>
        ) : null}

        {!ordersQuery.isLoading && !ordersQuery.isError && (ordersQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No orders match the current filters.</p>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Line Items</TableHead>
              <TableHead>Total Qty</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordersQuery.data?.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <div className="grid gap-0.5">
                    <span className="font-medium">{order.order_number}</span>
                    <span className="text-xs text-muted-foreground">{order.id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(order.status)}>{formatStatus(order.status)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="grid gap-0.5">
                    <span className="font-medium">{order.customer.business_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {order.customer.customer_code ?? "No customer code"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{formatLineItems(order)}</TableCell>
                <TableCell>{totalQuantity(order).toLocaleString()}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {new Date(order.updated_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function formatStatus(status: OrderStatus): string {
  return status.replaceAll("_", " ")
}

function statusVariant(status: OrderStatus): "default" | "secondary" | "destructive" {
  if (status === "canceled") {
    return "destructive"
  }

  if (status === "completed" || status === "partial_released") {
    return "default"
  }

  return "secondary"
}

function totalQuantity(order: Order): number {
  return order.items.reduce((total, item) => total + item.quantity, 0)
}

function formatLineItems(order: Order): string {
  if (order.items.length === 0) {
    return "No line items"
  }

  const [firstItem, ...remainingItems] = order.items
  const firstItemLabel = `${firstItem.cup.sku} x ${firstItem.quantity.toLocaleString()}`

  if (remainingItems.length === 0) {
    return firstItemLabel
  }

  return `${firstItemLabel} + ${remainingItems.length} more`
}
