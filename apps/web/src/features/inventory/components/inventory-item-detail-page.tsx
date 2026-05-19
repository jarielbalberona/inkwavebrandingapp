import { useMemo } from "react"

import { Link, Navigate } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  appPermissions,
  getDefaultAuthorizedRoute,
  hasPermission,
} from "@/features/auth/permissions"
import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import type {
  InventoryBalance,
  InventoryItemType,
  InventoryMovementListItem,
} from "@/features/inventory/api/inventory-client"
import { useInventoryItemDetailQuery } from "@/features/inventory/hooks/use-inventory"

interface InventoryItemDetailPageProps {
  itemType: string
  itemId: string
}

export function InventoryItemDetailPage({
  itemType,
  itemId,
}: InventoryItemDetailPageProps) {
  const currentUser = useCurrentUser()
  const parsedItemType = parseInventoryItemType(itemType)
  const detailQuery = useInventoryItemDetailQuery(parsedItemType, itemId)
  const canViewInventory = hasPermission(
    currentUser.data,
    appPermissions.inventoryView
  )
  const linkedOrders = useMemo(
    () => getLinkedOrders(detailQuery.data?.movements ?? []),
    [detailQuery.data?.movements]
  )

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canViewInventory) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/inventory") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>
          Inventory visibility requires inventory-view permission.
        </AlertDescription>
      </Alert>
    )
  }

  if (!parsedItemType) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Inventory item type is invalid.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="grid gap-1">
              <CardTitle>
                {detailQuery.data
                  ? formatInventoryItemPrimaryLabel(detailQuery.data.balance)
                  : "Inventory item"}
              </CardTitle>
              <CardDescription>
                {detailQuery.data
                  ? formatInventoryItemSecondaryLabel(detailQuery.data.balance)
                  : "Loading inventory item detail..."}
              </CardDescription>
            </div>
            <Button asChild type="button" variant="outline">
              <Link to="/inventory">Back to inventory</Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          {detailQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading inventory item detail...
            </p>
          ) : null}

          {detailQuery.isError ? (
            <p className="text-sm text-destructive">
              {detailQuery.error.message}
            </p>
          ) : null}

          {detailQuery.data ? (
            <>
              <InventoryBalanceBreakdown balance={detailQuery.data.balance} />
              <LinkedOrdersSummary orders={linkedOrders} />
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movement Breakdown</CardTitle>
          <CardDescription>
            Ledger entries for this item. Order-linked movements include the
            order line that produced the reservation, release, or consumption.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!detailQuery.isLoading &&
          !detailQuery.isError &&
          (detailQuery.data?.movements.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No movements recorded for this inventory item.
            </p>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Movement</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Created by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailQuery.data?.movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(movement.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={movementVariant(movement.movement_type)}>
                      {movement.movement_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{movement.quantity}</TableCell>
                  <TableCell>
                    {movement.linked_order ? (
                      <div className="grid gap-1">
                        <Button
                          asChild
                          type="button"
                          variant="link"
                          className="h-auto justify-start p-0"
                        >
                          <Link
                            to="/orders/$orderId"
                            params={{ orderId: movement.linked_order.id }}
                          >
                            {formatLinkedOrderLabel(movement.linked_order)}
                          </Link>
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {movement.linked_order.order_item
                            ? `${movement.linked_order.order_item.description_snapshot} x ${movement.linked_order.order_item.quantity}`
                            : "Order-level movement"}
                        </span>
                      </div>
                    ) : (
                      "No linked order"
                    )}
                  </TableCell>
                  <TableCell>{movement.reference ?? "-"}</TableCell>
                  <TableCell>{movement.note ?? "-"}</TableCell>
                  <TableCell>
                    {movement.created_by
                      ? (movement.created_by.display_name ??
                        movement.created_by.email)
                      : "System"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function InventoryBalanceBreakdown({ balance }: { balance: InventoryBalance }) {
  const minStock =
    balance.item_type === "cup" ? balance.cup.min_stock : balance.lid.min_stock

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <SummaryMetric label="In Stock" value={balance.on_hand} />
      <SummaryMetric label="For Orders" value={balance.reserved} />
      <SummaryMetric
        label="Net Available"
        value={balance.available}
        tone={balance.available < 0 ? "danger" : undefined}
      />
      <SummaryMetric label="Min Stock" value={minStock} />
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "danger"
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={
          tone === "danger"
            ? "text-2xl font-semibold text-destructive"
            : "text-2xl font-semibold"
        }
      >
        {value}
      </p>
    </div>
  )
}

function LinkedOrdersSummary({ orders }: { orders: LinkedOrderSummary[] }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Linked Orders</h2>
        <Badge variant="outline">{orders.length}</Badge>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No order-linked inventory movements for this item yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>Movements</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Button
                    asChild
                    type="button"
                    variant="link"
                    className="h-auto justify-start p-0"
                  >
                    <Link to="/orders/$orderId" params={{ orderId: order.id }}>
                      {order.orderNumber}
                    </Link>
                  </Button>
                </TableCell>
                <TableCell>
                  <Badge variant={orderStatusVariant(order.status)}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {order.orderItemDescription ?? "Order-level movement"}
                </TableCell>
                <TableCell>{order.movementCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

interface LinkedOrderSummary {
  id: string
  orderNumber: string
  status: string
  orderItemDescription: string | null
  movementCount: number
}

function getLinkedOrders(
  movements: InventoryMovementListItem[]
): LinkedOrderSummary[] {
  const orders = new Map<string, LinkedOrderSummary>()

  for (const movement of movements) {
    if (!movement.linked_order) {
      continue
    }

    const existing = orders.get(movement.linked_order.id)
    if (existing) {
      existing.movementCount += 1
      continue
    }

    orders.set(movement.linked_order.id, {
      id: movement.linked_order.id,
      orderNumber: formatLinkedOrderLabel(movement.linked_order),
      status: movement.linked_order.status,
      orderItemDescription:
        movement.linked_order.order_item?.description_snapshot ?? null,
      movementCount: 1,
    })
  }

  return [...orders.values()]
}

function formatLinkedOrderLabel(order: {
  client_name: string | null
  order_number: string
}): string {
  return order.client_name
    ? `${order.client_name} - ${order.order_number}`
    : order.order_number
}

function parseInventoryItemType(value: string): InventoryItemType | null {
  if (value === "cup" || value === "lid") {
    return value
  }

  return null
}

function formatInventoryItemPrimaryLabel(balance: InventoryBalance): string {
  return balance.item_type === "cup" ? balance.cup.sku : balance.lid.sku
}

function formatInventoryItemSecondaryLabel(balance: InventoryBalance): string {
  if (balance.item_type === "cup") {
    return `${balance.cup.brand} - ${balance.cup.size} - ${balance.cup.color}`
  }

  return `${balance.lid.type} - ${balance.lid.brand} - ${balance.lid.shape} - ${balance.lid.color}`
}

function movementVariant(
  type: string
): "default" | "secondary" | "destructive" {
  if (type === "adjustment_out" || type === "consume") {
    return "destructive"
  }

  if (type === "reserve" || type === "release_reservation") {
    return "secondary"
  }

  return "default"
}

function orderStatusVariant(
  status: string
): "default" | "secondary" | "destructive" {
  if (status === "canceled") {
    return "destructive"
  }

  if (status === "completed") {
    return "secondary"
  }

  return "default"
}
