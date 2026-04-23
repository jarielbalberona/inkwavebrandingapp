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
import type {
  Order,
  OrderStatus,
  ProgressStage,
  ProgressTotals,
} from "@/features/orders/api/orders-client"
import {
  progressStageOptions,
  useCreateProgressEventMutation,
  useCreateOrderMutation,
  useOrderQuery,
  useProgressEventsQuery,
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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | null>(null)
  const [progressStage, setProgressStage] = useState<ProgressStage>("printed")
  const [progressQuantity, setProgressQuantity] = useState("1")
  const [progressNote, setProgressNote] = useState("")
  const [progressEventDate, setProgressEventDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [progressError, setProgressError] = useState<string | null>(null)
  const [progressSuccess, setProgressSuccess] = useState<string | null>(null)
  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
    }),
    [status],
  )
  const ordersQuery = useOrdersQuery(query)
  const selectedOrderQuery = useOrderQuery(selectedOrderId)
  const progressEventsQuery = useProgressEventsQuery(selectedLineItemId)
  const cupsQuery = useCupsQuery()
  const createOrderMutation = useCreateOrderMutation()
  const createProgressEventMutation = useCreateProgressEventMutation()
  const activeCups = useMemo(
    () => (cupsQuery.data ?? []).filter((cup) => cup.is_active),
    [cupsQuery.data],
  )
  const selectedOrder =
    selectedOrderQuery.data ?? ordersQuery.data?.find((order) => order.id === selectedOrderId) ?? null
  const selectedLineItem =
    selectedOrder?.items.find((item) => item.id === selectedLineItemId) ?? null

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

  function handleSelectOrder(order: Order) {
    setSelectedOrderId(order.id)
    setSelectedLineItemId(order.items[0]?.id ?? null)
    setProgressError(null)
    setProgressSuccess(null)
  }

  async function handleCreateProgressEvent() {
    setProgressError(null)
    setProgressSuccess(null)

    if (!selectedOrder || !selectedLineItem) {
      setProgressError("Select an order line item before recording progress.")
      return
    }

    if (selectedOrder.status === "canceled" || selectedOrder.status === "completed") {
      setProgressError("Canceled or completed orders cannot receive new progress events.")
      return
    }

    const quantity = Number(progressQuantity)

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setProgressError("Enter a positive whole-number progress quantity.")
      return
    }

    if (!progressEventDate) {
      setProgressError("Select an event date.")
      return
    }

    const totals = progressEventsQuery.data?.totals

    if (totals) {
      const maxQuantity = maxQuantityForStage(progressStage, selectedLineItem.quantity, totals)

      if (quantity > maxQuantity) {
        setProgressError(
          `${formatStatus(progressStage)} quantity cannot exceed the current stage balance of ${maxQuantity}.`,
        )
        return
      }
    }

    try {
      const result = await createProgressEventMutation.mutateAsync({
        orderLineItemId: selectedLineItem.id,
        payload: {
          stage: progressStage,
          quantity,
          note: progressNote.trim() || undefined,
          event_date: progressEventDate,
        },
      })

      setProgressQuantity("1")
      setProgressNote("")
      setProgressSuccess(`Recorded ${formatStatus(result.event.stage)} x ${result.event.quantity}.`)
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "Unable to record progress.")
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
              <TableHead>Fulfillment</TableHead>
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
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectOrder(order)}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4">
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

        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Fulfillment Progress</CardTitle>
            <CardDescription>
              Select an order line item and record quantity-based progress events.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!selectedOrder ? (
              <p className="text-sm text-muted-foreground">
                Select Manage from an order row to record fulfillment progress.
              </p>
            ) : null}

            {selectedOrder ? (
              <>
                <div className="grid gap-1 text-sm">
                  <p className="font-medium">{selectedOrder.order_number}</p>
                  <p className="text-muted-foreground">
                    {selectedOrder.customer.business_name} · {formatStatus(selectedOrder.status)}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Line item</Label>
                  <Select
                    value={selectedLineItemId ?? undefined}
                    onValueChange={(lineItemId) => {
                      setSelectedLineItemId(lineItemId)
                      setProgressError(null)
                      setProgressSuccess(null)
                    }}
                  >
                    <SelectTrigger className="w-full rounded-none">
                      <SelectValue placeholder="Select line item" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {selectedOrder.items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.cup.sku} x {item.quantity.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLineItem ? (
                  <div className="grid gap-4">
                    <div className="grid gap-2 border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{selectedLineItem.cup.sku}</p>
                          <p className="text-muted-foreground">
                            {selectedLineItem.cup.brand} · {selectedLineItem.cup.size} ·{" "}
                            {selectedLineItem.cup.dimension}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          Ordered {selectedLineItem.quantity.toLocaleString()}
                        </Badge>
                      </div>
                      {progressEventsQuery.isLoading ? (
                        <p className="text-muted-foreground">Loading progress totals...</p>
                      ) : null}
                      {progressEventsQuery.isError ? (
                        <p className="text-destructive">{progressEventsQuery.error.message}</p>
                      ) : null}
                      {progressEventsQuery.data ? (
                        <ProgressTotalsGrid totals={progressEventsQuery.data.totals} />
                      ) : null}
                    </div>

                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label>Stage</Label>
                        <Select
                          value={progressStage}
                          onValueChange={(value) => setProgressStage(value as ProgressStage)}
                        >
                          <SelectTrigger className="w-full rounded-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-none">
                            {progressStageOptions.map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {formatStatus(stage)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="progress-quantity">Quantity</Label>
                        <Input
                          id="progress-quantity"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={progressQuantity}
                          onChange={(event) => setProgressQuantity(event.target.value)}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="progress-date">Event date</Label>
                        <Input
                          id="progress-date"
                          type="date"
                          value={progressEventDate}
                          onChange={(event) => setProgressEventDate(event.target.value)}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="progress-note">Note</Label>
                        <Textarea
                          id="progress-note"
                          value={progressNote}
                          placeholder="Optional production note"
                          onChange={(event) => setProgressNote(event.target.value)}
                        />
                      </div>

                      {progressError ? (
                        <Alert variant="destructive">
                          <AlertDescription>{progressError}</AlertDescription>
                        </Alert>
                      ) : null}

                      {progressSuccess ? (
                        <Alert>
                          <AlertDescription>{progressSuccess}</AlertDescription>
                        </Alert>
                      ) : null}

                      <Button
                        type="button"
                        className="rounded-none"
                        disabled={
                          createProgressEventMutation.isPending ||
                          selectedOrder.status === "canceled" ||
                          selectedOrder.status === "completed"
                        }
                        onClick={handleCreateProgressEvent}
                      >
                        {createProgressEventMutation.isPending ? "Recording progress..." : "Record progress"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatStatus(status: OrderStatus | ProgressStage): string {
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

function ProgressTotalsGrid({ totals }: { totals: ProgressTotals }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
      <ProgressTotal label="Printed" value={totals.total_printed} />
      <ProgressTotal label="QA passed" value={totals.total_qa_passed} />
      <ProgressTotal label="Packed" value={totals.total_packed} />
      <ProgressTotal label="Ready" value={totals.total_ready_for_release} />
      <ProgressTotal label="Released" value={totals.total_released} />
      <ProgressTotal label="Remaining" value={totals.remaining_balance} />
    </div>
  )
}

function ProgressTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="border bg-muted/30 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value.toLocaleString()}</p>
    </div>
  )
}

function maxQuantityForStage(
  stage: ProgressStage,
  orderedQuantity: number,
  totals: ProgressTotals,
): number {
  switch (stage) {
    case "printed":
      return Math.max(orderedQuantity - totals.total_printed, 0)
    case "qa_passed":
      return Math.max(totals.total_printed - totals.total_qa_passed, 0)
    case "packed":
      return Math.max(totals.total_qa_passed - totals.total_packed, 0)
    case "ready_for_release":
      return Math.max(totals.total_packed - totals.total_ready_for_release, 0)
    case "released":
      return Math.max(totals.total_ready_for_release - totals.total_released, 0)
  }
}
