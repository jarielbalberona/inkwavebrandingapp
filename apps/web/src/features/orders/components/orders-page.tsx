import { useMemo, useState, type Dispatch, type SetStateAction } from "react"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
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
import { Textarea } from "@workspace/ui/components/textarea"

import type { Cup } from "@/features/cups/api/cups-client"
import { useCupsQuery } from "@/features/cups/hooks/use-cups"
import type { Customer } from "@/features/customers/api/customers-client"
import { CustomerSearchSelect } from "@/features/customers/components/customer-search-select"
import type { Order, OrderStatus } from "@/features/orders/api/orders-client"
import {
  useCreateOrderMutation,
  orderStatusOptions,
  useOrdersQuery,
} from "@/features/orders/hooks/use-orders"

interface DraftLineItem {
  id: string
  cupId: string
  quantity: string
  notes: string
}

const createDraftLineItem = (): DraftLineItem => ({
  id: crypto.randomUUID(),
  cupId: "",
  quantity: "1",
  notes: "",
})

export function OrdersPage() {
  const [status, setStatus] = useState<OrderStatus | "all">("all")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [notes, setNotes] = useState("")
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([createDraftLineItem()])
  const [formError, setFormError] = useState<string | null>(null)
  const [lastCreatedOrderNumber, setLastCreatedOrderNumber] = useState<string | null>(null)
  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
    }),
    [status],
  )
  const ordersQuery = useOrdersQuery(query)
  const cupsQuery = useCupsQuery()
  const createOrderMutation = useCreateOrderMutation()
  const activeCups = useMemo(
    () => (cupsQuery.data ?? []).filter((cup) => cup.is_active),
    [cupsQuery.data],
  )

  async function handleCreateOrder() {
    setFormError(null)
    setLastCreatedOrderNumber(null)

    if (!selectedCustomer) {
      setFormError("Select a customer before creating an order.")
      return
    }

    const parsedLineItems = lineItems.map((item) => ({
      cup_id: item.cupId,
      quantity: Number(item.quantity),
      notes: item.notes.trim() || undefined,
    }))

    if (parsedLineItems.length === 0 || parsedLineItems.some((item) => !item.cup_id)) {
      setFormError("Select a cup for every line item.")
      return
    }

    if (parsedLineItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      setFormError("Enter a positive whole-number quantity for every line item.")
      return
    }

    if (new Set(parsedLineItems.map((item) => item.cup_id)).size !== parsedLineItems.length) {
      setFormError("Each cup can only appear once per order.")
      return
    }

    try {
      const order = await createOrderMutation.mutateAsync({
        customer_id: selectedCustomer.id,
        notes: notes.trim() || undefined,
        line_items: parsedLineItems,
      })

      setSelectedCustomer(null)
      setNotes("")
      setLineItems([createDraftLineItem()])
      setLastCreatedOrderNumber(order.order_number)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to create order.")
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <Card className="rounded-none">
        <CardHeader className="gap-4">
          <div className="grid gap-1">
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              Derived fulfillment status from production progress. No stale printing status, no
              client-side financial redaction.
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

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Create Pending Order</CardTitle>
          <CardDescription>
            Select a real customer and cups. Submission creates a pending order and reserves stock.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <CustomerSearchSelect
            selectedCustomerId={selectedCustomer?.id ?? null}
            onSelect={setSelectedCustomer}
          />

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Line items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLineItems((items) => [...items, createDraftLineItem()])}
              >
                Add item
              </Button>
            </div>

            {lineItems.map((lineItem, index) => (
              <div key={lineItem.id} className="grid gap-3 border p-3">
                <div className="grid gap-2">
                  <Label>Cup SKU</Label>
                  <Select
                    value={lineItem.cupId || undefined}
                    onValueChange={(cupId) => updateLineItem(setLineItems, lineItem.id, { cupId })}
                  >
                    <SelectTrigger className="w-full rounded-none">
                      <SelectValue placeholder={cupsQuery.isLoading ? "Loading cups..." : "Select cup"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {activeCups.map((cup) => (
                        <SelectItem key={cup.id} value={cup.id}>
                          {formatCupOption(cup)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`line-item-quantity-${lineItem.id}`}>Quantity</Label>
                  <Input
                    id={`line-item-quantity-${lineItem.id}`}
                    inputMode="numeric"
                    min={1}
                    type="number"
                    value={lineItem.quantity}
                    onChange={(event) =>
                      updateLineItem(setLineItems, lineItem.id, { quantity: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`line-item-notes-${lineItem.id}`}>Line note</Label>
                  <Input
                    id={`line-item-notes-${lineItem.id}`}
                    value={lineItem.notes}
                    placeholder="Optional production note"
                    onChange={(event) =>
                      updateLineItem(setLineItems, lineItem.id, { notes: event.target.value })
                    }
                  />
                </div>

                {lineItems.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-self-start px-0"
                    onClick={() =>
                      setLineItems((items) => items.filter((item) => item.id !== lineItem.id))
                    }
                  >
                    Remove item {index + 1}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="order-notes">Order notes</Label>
            <Textarea
              id="order-notes"
              value={notes}
              placeholder="Optional order note"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {lastCreatedOrderNumber ? (
            <Alert>
              <AlertDescription>
                Created pending order {lastCreatedOrderNumber}. Stock was reserved by the API.
              </AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            className="rounded-none"
            disabled={createOrderMutation.isPending || cupsQuery.isLoading}
            onClick={handleCreateOrder}
          >
            {createOrderMutation.isPending ? "Creating order..." : "Create pending order"}
          </Button>
        </CardContent>
      </Card>
    </div>
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

function updateLineItem(
  setLineItems: Dispatch<SetStateAction<DraftLineItem[]>>,
  id: string,
  patch: Partial<Omit<DraftLineItem, "id">>,
) {
  setLineItems((items) =>
    items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  )
}

function formatCupOption(cup: Cup): string {
  return `${cup.sku} · ${cup.brand} · ${cup.size} · ${cup.dimension}`
}
