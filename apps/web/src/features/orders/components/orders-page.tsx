import { useMemo, useState } from "react"

import { Link } from "@tanstack/react-router"

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

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import type {
  Invoice,
  Order,
  OrderStatus,
  ProgressEvent,
  ProgressStage,
  ProgressTotals,
} from "@/features/orders/api/orders-client"
import {
  progressStageOptions,
  useCancelOrderMutation,
  useCreateProgressEventMutation,
  useGenerateOrderInvoiceMutation,
  useOrderQuery,
  useOrderInvoiceQuery,
  useProgressEventsQuery,
  orderStatusOptions,
  useOrdersQuery,
} from "@/features/orders/hooks/use-orders"
import { apiBaseUrl } from "@/lib/api"

export function OrdersPage() {
  const currentUser = useCurrentUser()
  const [status, setStatus] = useState<OrderStatus | "all">("all")
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
  const isAdmin = currentUser.data?.role === "admin"
  const orderInvoiceQuery = useOrderInvoiceQuery(selectedOrderId, isAdmin)
  const createProgressEventMutation = useCreateProgressEventMutation()
  const generateOrderInvoiceMutation = useGenerateOrderInvoiceMutation()
  const cancelOrderMutation = useCancelOrderMutation()
  const selectedOrder =
    selectedOrderQuery.data ?? ordersQuery.data?.find((order) => order.id === selectedOrderId) ?? null
  const selectedLineItem =
    selectedOrder?.items.find((item) => item.id === selectedLineItemId) ?? null
  const availableProgressStages = useMemo(
    () => getAllowedProgressStages(selectedLineItem?.item_type),
    [selectedLineItem?.item_type],
  )
  const effectiveProgressStage =
    availableProgressStages.includes(progressStage)
      ? progressStage
      : (availableProgressStages[0] ?? "printed")

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

    if (selectedLineItem.item_type === "lid" && effectiveProgressStage !== "released") {
      setProgressError("Lid line items only support released quantity events.")
      return
    }

    const totals = progressEventsQuery.data?.totals

    if (totals) {
      const maxQuantity = maxQuantityForStage(
        selectedLineItem.item_type,
        effectiveProgressStage,
        selectedLineItem.quantity,
        totals,
      )

      if (quantity > maxQuantity) {
        setProgressError(
          `${formatStatus(effectiveProgressStage)} quantity cannot exceed the current stage balance of ${maxQuantity}.`,
        )
        return
      }
    }

    try {
      const result = await createProgressEventMutation.mutateAsync({
        orderLineItemId: selectedLineItem.id,
        payload: {
          stage: effectiveProgressStage,
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

  async function handleCancelSelectedOrder() {
    setProgressError(null)
    setProgressSuccess(null)

    if (!selectedOrder) {
      return
    }

    if (!window.confirm(`Cancel order ${selectedOrder.order_number}? Unconsumed reservations will be released.`)) {
      return
    }

    try {
      const order = await cancelOrderMutation.mutateAsync(selectedOrder.id)

      setProgressSuccess(`Canceled ${order.order_number}. Unconsumed reservations were released by the API.`)
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "Unable to cancel order.")
    }
  }

  async function handleGenerateInvoice() {
    setProgressError(null)
    setProgressSuccess(null)

    if (!selectedOrder) {
      return
    }

    try {
      const invoice = await generateOrderInvoiceMutation.mutateAsync(selectedOrder.id)
      setProgressSuccess(`Generated invoice ${invoice.invoice_number}.`)
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "Unable to generate invoice.")
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <Card className="rounded-none">
        <CardHeader className="gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <CardTitle>Orders</CardTitle>
              <CardDescription>
                Order creation and editing now live on dedicated pages. This screen stays focused on list visibility and fulfillment operations.
              </CardDescription>
            </div>
            <Button asChild>
              <Link to="/orders/new">Create Order</Link>
            </Button>
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
                <TableHead>Actions</TableHead>
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectOrder(order)}
                      >
                        Fulfillment
                      </Button>
                      <Button asChild type="button" variant="outline" size="sm">
                        <Link to="/orders/$orderId/edit" params={{ orderId: order.id }}>
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Fulfillment Progress</CardTitle>
          <CardDescription>
            Select an order and line item to record quantity-based fulfillment events.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!selectedOrder ? (
            <p className="text-sm text-muted-foreground">
              Select Fulfillment from an order row to manage line-item progress.
            </p>
          ) : (
            <>
              <div className="grid gap-1 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{selectedOrder.order_number}</p>
                    <p className="text-muted-foreground">
                      {selectedOrder.customer.business_name} · {formatStatus(selectedOrder.status)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={
                      cancelOrderMutation.isPending ||
                      selectedOrder.status === "canceled" ||
                      selectedOrder.status === "completed"
                    }
                    onClick={handleCancelSelectedOrder}
                  >
                    {cancelOrderMutation.isPending ? "Canceling..." : "Cancel"}
                  </Button>
                </div>
              </div>

              {isAdmin ? (
                <InvoicePanel
                  invoice={orderInvoiceQuery.data}
                  invoiceError={orderInvoiceQuery.isError ? orderInvoiceQuery.error.message : null}
                  isGenerating={generateOrderInvoiceMutation.isPending}
                  isLoading={orderInvoiceQuery.isLoading}
                  onGenerate={handleGenerateInvoice}
                  orderStatus={selectedOrder.status}
                />
              ) : null}

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
                        {formatOrderItemLabel(item)} x {item.quantity.toLocaleString()}
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
                        <p className="font-medium">{formatOrderItemLabel(selectedLineItem)}</p>
                        <p className="text-muted-foreground">
                          {formatOrderItemDetails(selectedLineItem)}
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

                  {progressEventsQuery.data ? (
                    <ProgressHistory events={progressEventsQuery.data.events} />
                  ) : null}

                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label>Stage</Label>
                      <Select
                        value={effectiveProgressStage}
                        onValueChange={(value) => setProgressStage(value as ProgressStage)}
                      >
                        <SelectTrigger className="w-full rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          {availableProgressStages.map((stage) => (
                            <SelectItem key={stage} value={stage}>
                              {formatStatus(stage)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="progress-quantity">Quantity</Label>
                      <Input.Number
                        id="progress-quantity"
                        min={1}
                        value={Number(progressQuantity)}
                        onChange={(value) => setProgressQuantity(String(value ?? 0))}
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
                        placeholder="Optional fulfillment note"
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InvoicePanel({
  invoice,
  invoiceError,
  isGenerating,
  isLoading,
  onGenerate,
  orderStatus,
}: {
  invoice: Invoice | undefined
  invoiceError: string | null
  isGenerating: boolean
  isLoading: boolean
  onGenerate: () => Promise<void>
  orderStatus: OrderStatus
}) {
  const hasInvoice = Boolean(invoice)
  const canGenerate = !hasInvoice && orderStatus === "completed"
  const resolvedInvoice = invoice ?? null

  return (
    <div className="grid gap-3 border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="font-medium">Invoice</p>
          <p className="text-muted-foreground">
            Admin-only snapshot generated from completed order line-item prices.
          </p>
        </div>
        {canGenerate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isGenerating}
            onClick={() => {
              void onGenerate()
            }}
          >
            {isGenerating ? "Generating..." : "Generate invoice"}
          </Button>
        ) : null}
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading invoice state...</p> : null}

      {resolvedInvoice ? (
        <div className="grid gap-2 md:grid-cols-3">
          <div className="border p-3">
            <p className="text-xs text-muted-foreground">Invoice number</p>
            <p className="font-medium">{resolvedInvoice.invoice_number}</p>
          </div>
          <div className="border p-3">
            <p className="text-xs text-muted-foreground">Subtotal</p>
            <p className="font-medium">{resolvedInvoice.subtotal}</p>
          </div>
          <div className="border p-3">
            <p className="text-xs text-muted-foreground">Generated</p>
            <p className="font-medium">{new Date(resolvedInvoice.created_at).toLocaleString()}</p>
          </div>
        </div>
      ) : null}

      {resolvedInvoice ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="justify-self-start"
          onClick={() => {
            window.open(`${apiBaseUrl}/invoices/${resolvedInvoice.id}/pdf`, "_blank", "noopener,noreferrer")
          }}
        >
          Open PDF
        </Button>
      ) : invoiceError ? (
        <p className="text-muted-foreground">
          {invoiceError === "No invoice has been generated for this order yet."
            ? "No invoice generated yet."
            : invoiceError}
        </p>
      ) : (
        <p className="text-muted-foreground">
          {orderStatus === "completed"
            ? "No invoice generated yet."
            : "Invoice generation is only allowed after the order is completed."}
        </p>
      )}
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
  const firstItemLabel = `${formatOrderItemLabel(firstItem)} x ${firstItem.quantity.toLocaleString()}`

  if (remainingItems.length === 0) {
    return firstItemLabel
  }

  return `${firstItemLabel} + ${remainingItems.length} more`
}

function formatOrderItemLabel(item: Order["items"][number]): string {
  return item.item_type === "cup" ? item.cup.sku : `${item.lid.diameter} ${item.lid.shape}`
}

function formatOrderItemDetails(item: Order["items"][number]): string {
  return item.item_type === "cup"
    ? `${item.cup.type} · ${item.cup.brand} · ${item.cup.size} · ${item.cup.diameter}`
    : `${item.lid.type} · ${item.lid.brand} · ${item.lid.color} · ${item.description_snapshot}`
}

function getAllowedProgressStages(
  itemType: Order["items"][number]["item_type"] | undefined,
): ProgressStage[] {
  if (itemType === "lid") {
    return ["released"]
  }

  return [...progressStageOptions]
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

function ProgressHistory({ events }: { events: ProgressEvent[] }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Progress history</Label>
        <Badge variant="secondary">{events.length} events</Badge>
      </div>

      {events.length === 0 ? (
        <p className="border bg-muted/30 p-3 text-sm text-muted-foreground">
          No progress events recorded for this line item yet.
        </p>
      ) : (
        <div className="max-h-80 overflow-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event date</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Recorded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(event.event_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{formatStatus(event.stage)}</Badge>
                  </TableCell>
                  <TableCell>{event.quantity.toLocaleString()}</TableCell>
                  <TableCell>{event.note ?? "—"}</TableCell>
                  <TableCell>{event.created_by?.display_name ?? "System"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(event.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function maxQuantityForStage(
  itemType: Order["items"][number]["item_type"],
  stage: ProgressStage,
  orderedQuantity: number,
  totals: ProgressTotals,
): number {
  if (itemType === "lid") {
    return stage === "released" ? Math.max(orderedQuantity - totals.total_released, 0) : 0
  }

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
