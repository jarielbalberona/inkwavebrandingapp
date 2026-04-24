import { useDeferredValue, useMemo, useState } from "react"

import { Link, useNavigate } from "@tanstack/react-router"
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd"
import { GripVertical } from "lucide-react"

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
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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

import type { Customer } from "@/features/customers/api/customers-client"
import { useCustomersQuery } from "@/features/customers/hooks/use-customers"
import type {
  Order,
  OrderStatus,
  ProgressEvent,
  ProgressStage,
  ProgressTotals,
} from "@/features/orders/api/orders-client"
import {
  progressStageOptions,
  useCreateProgressEventMutation,
  useOrderQuery,
  useProgressEventsQuery,
  useUpdateOrderPrioritiesMutation,
  orderStatusOptions,
  useOrdersQuery,
} from "@/features/orders/hooks/use-orders"
import { cn } from "@workspace/ui/lib/utils"

const priorityRowClasses = [
  "bg-rose-400/90 hover:bg-rose-400/90",
  "bg-rose-300/90 hover:bg-rose-300/90",
  "bg-rose-200/90 hover:bg-rose-200/90",
  "bg-rose-100/90 hover:bg-rose-100/90",
  "bg-rose-50 hover:bg-rose-50",
] as const

type OrdersSortOption = "priority" | "created_at"

export function OrdersPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<OrderStatus | "all">("all")
  const [customerFilterId, setCustomerFilterId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<OrdersSortOption>("priority")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | null>(
    null
  )
  const [isFulfillmentDialogOpen, setIsFulfillmentDialogOpen] = useState(false)
  const [progressStage, setProgressStage] = useState<ProgressStage>("printed")
  const [progressQuantity, setProgressQuantity] = useState("1")
  const [progressNote, setProgressNote] = useState("")
  const [progressEventDate, setProgressEventDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [progressError, setProgressError] = useState<string | null>(null)
  const [progressSuccess, setProgressSuccess] = useState<string | null>(null)
  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
    }),
    [status]
  )
  const ordersQuery = useOrdersQuery(query)
  const selectedOrderQuery = useOrderQuery(selectedOrderId)
  const selectedOrder =
    selectedOrderQuery.data ??
    ordersQuery.data?.find((order) => order.id === selectedOrderId) ??
    null
  const trackedLineItems =
    selectedOrder?.items.filter(
      (item) => item.item_type !== "non_stock_item" && item.item_type !== "custom_charge",
    ) ?? []
  const selectedLineItem =
    selectedOrder?.items.find((item) => item.id === selectedLineItemId) ?? null
  const progressEventsQuery = useProgressEventsQuery(
    selectedLineItem?.item_type === "non_stock_item" || selectedLineItem?.item_type === "custom_charge"
      ? null
      : selectedLineItemId,
    selectedLineItem?.item_type !== "non_stock_item" && selectedLineItem?.item_type !== "custom_charge",
  )
  const createProgressEventMutation = useCreateProgressEventMutation()
  const updateOrderPrioritiesMutation = useUpdateOrderPrioritiesMutation()
  const filteredOrders = useMemo(() => {
    const orders = ordersQuery.data ?? []

    if (!customerFilterId) {
      return orders
    }

    return orders.filter((order) => order.customer.id === customerFilterId)
  }, [customerFilterId, ordersQuery.data])
  const sortedOrders = useMemo(
    () => sortOrders(filteredOrders, sortBy),
    [filteredOrders, sortBy]
  )
  const availableProgressStages = getAllowedProgressStages(selectedLineItem?.item_type)
  const effectiveProgressStage = availableProgressStages.includes(progressStage)
    ? progressStage
    : (availableProgressStages[0] ?? "printed")

  function openFulfillmentDialog(order: Order) {
    setSelectedOrderId(order.id)
    const firstTrackedLineItem = order.items.find(
      (item) => item.item_type !== "non_stock_item" && item.item_type !== "custom_charge",
    )
    setSelectedLineItemId(firstTrackedLineItem?.id ?? null)
    setProgressStage("printed")
    setProgressQuantity("1")
    setProgressNote("")
    setProgressEventDate(new Date().toISOString().slice(0, 10))
    setProgressError(null)
    setProgressSuccess(null)
    setIsFulfillmentDialogOpen(true)
  }

  function handleFulfillmentDialogOpenChange(open: boolean) {
    setIsFulfillmentDialogOpen(open)

    if (!open) {
      setProgressError(null)
      setProgressSuccess(null)
    }
  }

  async function handleCreateProgressEvent() {
    setProgressError(null)
    setProgressSuccess(null)

    if (!selectedOrder || !selectedLineItem) {
      setProgressError("Select an order line item before recording progress.")
      return
    }

    if (
      selectedLineItem.item_type === "non_stock_item" ||
      selectedLineItem.item_type === "custom_charge"
    ) {
      setProgressError("General items and custom charges do not participate in fulfillment progress.")
      return
    }

    if (
      selectedOrder.status === "canceled" ||
      selectedOrder.status === "completed"
    ) {
      setProgressError(
        "Canceled or completed orders cannot receive new progress events."
      )
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
      const maxQuantity = maxQuantityForStage(
        selectedLineItem.item_type,
        effectiveProgressStage,
        selectedLineItem.quantity,
        totals
      )

      if (quantity > maxQuantity) {
        setProgressError(
          `${formatStatus(effectiveProgressStage)} quantity cannot exceed the current stage balance of ${maxQuantity}.`
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
      setProgressSuccess(
        `Recorded ${formatStatus(result.event.stage)} x ${result.event.quantity}.`
      )
    } catch (error) {
      setProgressError(
        error instanceof Error ? error.message : "Unable to record progress."
      )
    }
  }

  function navigateToOrder(orderId: string) {
    void navigate({ to: "/orders/$orderId", params: { orderId } })
  }

  function handlePriorityDragEnd(result: DropResult) {
    if (sortBy !== "priority" || !result.destination) {
      return
    }

    const reorderedIds = reorderPriorityIds(
      (ordersQuery.data ?? []).map((order) => order.id),
      sortedOrders.map((order) => order.id),
      result.source.index,
      result.destination.index
    )

    void updateOrderPrioritiesMutation.mutateAsync({
      order_ids: reorderedIds,
    })
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-none">
        <CardHeader className="gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <CardTitle>Orders</CardTitle>
              <CardDescription>
                Order creation and editing now live on dedicated pages. This
                screen stays focused on list visibility and fulfillment
                operations.
              </CardDescription>
            </div>
            <Button asChild>
              <Link to="/orders/new">Create Order</Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Fulfillment status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as OrderStatus | "all")}
              >
                <SelectTrigger className="w-full rounded-none">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="all">All statuses</SelectItem>
                  {orderStatusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {formatFilterStatus(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Customer</Label>
              <OrdersCustomerFilter
                selectedCustomerId={customerFilterId}
                onSelectCustomerId={setCustomerFilterId}
              />
            </div>

            <div className="grid gap-2">
              <Label>Sort by</Label>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as OrdersSortOption)}
              >
                <SelectTrigger className="w-full rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="created_at">Creation date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          {ordersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading orders...</p>
          ) : null}

          {ordersQuery.isError ? (
            <p className="text-sm text-destructive">
              {ordersQuery.error.message}
            </p>
          ) : null}

          {!ordersQuery.isLoading &&
          !ordersQuery.isError &&
          sortedOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No orders match the current filters.
            </p>
          ) : null}

          <DragDropContext onDragEnd={handlePriorityDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Line Items</TableHead>
                  <TableHead>Total Qty</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <Droppable droppableId="orders-table" direction="vertical">
                {(provided) => (
                  <TableBody
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {sortedOrders.map((order, index) => (
                      <Draggable
                        key={order.id}
                        draggableId={order.id}
                        index={index}
                        isDragDisabled={sortBy !== "priority"}
                      >
                        {(draggableProvided, snapshot) => (
                          <TableRow
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            key={order.id}
                            className={cn(
                              "cursor-pointer",
                              priorityRowClass(
                                getPriorityIndex(order.id, ordersQuery.data ?? [])
                              ),
                              snapshot.isDragging ? "shadow-lg" : ""
                            )}
                            tabIndex={0}
                            onClick={() => navigateToOrder(order.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                navigateToOrder(order.id)
                              }
                            }}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className={cn(
                                    "inline-flex size-7 items-center justify-center rounded-none border border-border bg-background text-muted-foreground",
                                    sortBy !== "priority"
                                      ? "cursor-not-allowed opacity-40"
                                      : "cursor-grab active:cursor-grabbing",
                                    updateOrderPrioritiesMutation.isPending
                                      ? "opacity-50"
                                      : ""
                                  )}
                                  aria-label={`Drag to reorder ${order.order_number}`}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  {...draggableProvided.dragHandleProps}
                                  disabled={updateOrderPrioritiesMutation.isPending}
                                >
                                  <GripVertical className="size-4" />
                                </button>
                                <span className="text-sm font-medium">
                                  {index + 1}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="grid gap-0.5">
                                <span className="font-medium">
                                  {order.order_number}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(order.status)}>
                                {formatStatus(order.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="grid gap-0.5">
                                <span className="font-medium">
                                  {order.customer.business_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{formatLineItems(order)}</TableCell>
                            <TableCell>
                              {totalQuantity(order).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {new Date(order.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {new Date(order.updated_at).toLocaleString()}
                            </TableCell>
                            <TableCell
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    !order.items.some(
                                      (item) =>
                                        item.item_type !== "non_stock_item" &&
                                        item.item_type !== "custom_charge",
                                    )
                                  }
                                  onClick={() => openFulfillmentDialog(order)}
                                >
                                  Fulfillment Progress
                                </Button>
                                <Button
                                  asChild
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                >
                                  <Link
                                    to="/orders/$orderId"
                                    params={{ orderId: order.id }}
                                  >
                                    View
                                  </Link>
                                </Button>
                                <Button
                                  asChild
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                >
                                  <Link
                                    to="/orders/$orderId/edit"
                                    params={{ orderId: order.id }}
                                  >
                                    Edit
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </TableBody>
                )}
              </Droppable>
            </Table>
          </DragDropContext>
        </CardContent>
      </Card>

      <Dialog
        open={isFulfillmentDialogOpen}
        onOpenChange={handleFulfillmentDialogOpenChange}
      >
        <DialogContent className="max-w-4xl!">
          <DialogHeader>
            <DialogTitle>Fulfillment Progress</DialogTitle>
            <DialogDescription>
              Select an order line item and record quantity-based fulfillment
              events.
            </DialogDescription>
          </DialogHeader>

          {!selectedOrder ? (
            <p className="text-sm text-muted-foreground">
              Select Fulfillment Progress from an order row to manage line-item
              progress.
            </p>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-1 text-sm">
                <p className="font-medium">{selectedOrder.order_number}</p>
                <p className="text-muted-foreground">
                  {selectedOrder.customer.business_name} ·{" "}
                  {formatStatus(selectedOrder.status)}
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
                    {trackedLineItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {formatOrderItemLabel(item)} x{" "}
                        {item.quantity.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {trackedLineItems.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    This order only contains non-inventory lines. There is no fulfillment progress
                    workflow because general items and custom charges do not reserve or consume inventory.
                  </AlertDescription>
                </Alert>
              ) : null}

              {selectedLineItem ? (
                <div className="grid gap-4">
                  <div className="grid gap-2 border p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {formatOrderItemLabel(selectedLineItem)}
                        </p>
                        <p className="text-muted-foreground">
                          {formatOrderItemDetails(selectedLineItem)}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        Ordered {selectedLineItem.quantity.toLocaleString()}
                      </Badge>
                    </div>
                    {progressEventsQuery.isLoading ? (
                      <p className="text-muted-foreground">
                        Loading progress totals...
                      </p>
                    ) : null}
                    {progressEventsQuery.isError ? (
                      <p className="text-destructive">
                        {progressEventsQuery.error.message}
                      </p>
                    ) : null}
                    {progressEventsQuery.data ? (
                      <ProgressTotalsGrid
                        itemType={selectedLineItem.item_type}
                        totals={progressEventsQuery.data.totals}
                      />
                    ) : null}
                  </div>

                  {progressEventsQuery.data ? (
                    <ProgressHistory events={progressEventsQuery.data.events} />
                  ) : null}

                  <div className="grid gap-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Stage</Label>
                        <Select
                          value={effectiveProgressStage}
                          onValueChange={(value) =>
                            setProgressStage(value as ProgressStage)
                          }
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
                          onChange={(value) =>
                            setProgressQuantity(String(value ?? 0))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="progress-date">Event date</Label>
                      <Input
                        id="progress-date"
                        type="date"
                        value={progressEventDate}
                        onChange={(event) =>
                          setProgressEventDate(event.target.value)
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="progress-note">Note</Label>
                      <Textarea
                        id="progress-note"
                        value={progressNote}
                        placeholder="Optional fulfillment note"
                        onChange={(event) =>
                          setProgressNote(event.target.value)
                        }
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
                      {createProgressEventMutation.isPending
                        ? "Recording progress..."
                        : "Record progress"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OrdersCustomerFilter({
  selectedCustomerId,
  onSelectCustomerId,
}: {
  selectedCustomerId: string | null
  onSelectCustomerId: (customerId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search.trim())
  const customersQuery = useCustomersQuery({
    includeInactive: true,
    search: open ? deferredSearch || undefined : undefined,
  })
  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data])
  const selectedCustomer = useMemo(
    () =>
      selectedCustomerId
        ? customers.find((customer) => customer.id === selectedCustomerId) ?? null
        : null,
    [customers, selectedCustomerId]
  )

  return (
    <div className="grid gap-2">
      <Combobox
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)

          if (!nextOpen) {
            setSearch((current) =>
              updateCustomerFilterSearch(selectedCustomerId, customers, current)
            )
          }
        }}
        value={selectedCustomer}
        onValueChange={(customer: Customer | null) =>
          {
            onSelectCustomerId(customer?.id ?? null)
            setSearch(customer ? customerFilterLabel(customer) : "")
          }
        }
        inputValue={search}
        onInputValueChange={setSearch}
        items={customers}
        itemToStringLabel={customerFilterLabel}
        itemToStringValue={(customer) => customer.id}
        isItemEqualToValue={(a, b) => a.id === b.id}
        filter={null}
      >
        <ComboboxInput
          placeholder="Search customer"
          showClear
          className="w-full min-w-0"
        />
        <ComboboxContent className="rounded-none">
          <ComboboxEmpty>
            {customersQuery.isLoading ? "Searching customers..." : "No customers found."}
          </ComboboxEmpty>
          <ComboboxList>
            {customers.map((customer) => (
              <ComboboxItem key={customer.id} value={customer}>
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="font-medium">{customerFilterLabel(customer)}</span>
                  <span className="text-xs text-muted-foreground">
                    {customerFilterMeta(customer)}
                  </span>
                </div>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

function priorityRowClass(index: number): string {
  return priorityRowClasses[index] ?? ""
}

function getPriorityIndex(orderId: string, orders: Order[]): number {
  return orders
    .slice()
    .sort((left, right) => {
      if (left.priority === right.priority) {
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      }

      return left.priority - right.priority
    })
    .findIndex((order) => order.id === orderId)
}

function sortOrders(orders: Order[], sortBy: OrdersSortOption): Order[] {
  const nextOrders = orders.slice()

  if (sortBy === "created_at") {
    return nextOrders.sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    )
  }

  return nextOrders.sort((left, right) => {
    if (left.priority === right.priority) {
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    }

    return left.priority - right.priority
  })
}

function reorderPriorityIds(
  currentIds: string[],
  visibleIds: string[],
  sourceIndex: number,
  destinationIndex: number
): string[] {
  const reorderedVisibleIds = visibleIds.slice()
  const [movedId] = reorderedVisibleIds.splice(sourceIndex, 1)

  if (!movedId) {
    return currentIds
  }

  reorderedVisibleIds.splice(destinationIndex, 0, movedId)

  const reorderedVisibleSet = new Set(reorderedVisibleIds)
  let replacementIndex = 0

  return currentIds.map((id) => {
    if (!reorderedVisibleSet.has(id)) {
      return id
    }

    const nextId = reorderedVisibleIds[replacementIndex]
    replacementIndex += 1
    return nextId ?? id
  })
}

function customerFilterLabel(customer: Customer): string {
  return customer.business_name
}

function customerFilterMeta(customer: Customer): string {
  return customer.customer_code ?? customer.contact_person ?? "No code"
}

function updateCustomerFilterSearch(
  selectedCustomerId: string | null,
  customers: Customer[],
  currentSearch: string
): string {
  if (!selectedCustomerId) {
    return currentSearch
  }

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId)
  return selectedCustomer ? customerFilterLabel(selectedCustomer) : currentSearch
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ")
}

function formatFilterStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function statusVariant(
  status: OrderStatus
): "default" | "secondary" | "destructive" {
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


  return  order.items.length.toLocaleString()
}

function formatOrderItemLabel(item: Order["items"][number]): string {
  if (item.item_type === "cup") {
    return item.cup.sku
  }

  if (item.item_type === "lid") {
    return item.lid.sku
  }

  if (item.item_type === "custom_charge") {
    return item.description_snapshot
  }

  return item.non_stock_item.name
}

function formatOrderItemDetails(item: Order["items"][number]): string {
  if (item.item_type === "cup") {
    return `${item.cup.type} · ${item.cup.brand} · ${item.cup.size} · ${item.cup.diameter}`
  }

  if (item.item_type === "lid") {
    return `${item.lid.type} · ${item.lid.brand} · ${item.lid.color} · ${item.description_snapshot}`
  }

  if (item.item_type === "custom_charge") {
    return "Custom charge"
  }

  return item.non_stock_item.description?.trim() || item.description_snapshot
}

function getAllowedProgressStages(
  itemType: Order["items"][number]["item_type"] | undefined
): ProgressStage[] {
  if (
    itemType === "non_stock_item" ||
    itemType === "custom_charge" ||
    itemType === undefined
  ) {
    return []
  }

  if (itemType === "lid") {
    return ["packed", "ready_for_release", "released"]
  }

  return [...progressStageOptions]
}

function ProgressTotalsGrid({
  itemType,
  totals,
}: {
  itemType: Order["items"][number]["item_type"]
  totals: ProgressTotals
}) {
  return (
    <div className="grid grid-cols-3 gap-3 text-xs sm:grid-cols-4">
      <div className="border bg-muted/30 p-2">
        <p className="text-muted-foreground">Status</p>
        <p className="text-base font-semibold">
          {formatStatus(totals.line_item_status)}
        </p>
      </div>
      {itemType === "cup" ? (
        <ProgressTotal label="Printed" value={totals.total_printed} />
      ) : null}
      {itemType === "cup" ? (
        <ProgressTotal label="QA passed" value={totals.total_qa_passed} />
      ) : null}
      <ProgressTotal label="Packed" value={totals.total_packed} />
      <ProgressTotal label="Ready" value={totals.total_ready_for_release} />
      <ProgressTotal className="bg-primary/10" label="Released" value={totals.total_released} />
      <ProgressTotal className="bg-destructive/10" label="Remaining" value={totals.remaining_balance} />
    </div>
  )
}

function ProgressTotal({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={cn("border bg-muted/30 p-2", className)}>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value.toLocaleString()}</p>
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
          No progress events recorded for this line item yet. Current derived
          status: not started.
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
                    <Badge variant="secondary">
                      {formatStatus(event.stage)}
                    </Badge>
                  </TableCell>
                  <TableCell>{event.quantity.toLocaleString()}</TableCell>
                  <TableCell>{event.note ?? "—"}</TableCell>
                  <TableCell>
                    {event.created_by?.display_name ?? "System"}
                  </TableCell>
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
  totals: ProgressTotals
): number {
  if (itemType === "non_stock_item" || itemType === "custom_charge") {
    return 0
  }

  if (itemType === "lid") {
    switch (stage) {
      case "packed":
        return Math.max(orderedQuantity - totals.total_packed, 0)
      case "ready_for_release":
        return Math.max(totals.total_packed - totals.total_ready_for_release, 0)
      case "released":
        return Math.max(
          totals.total_ready_for_release - totals.total_released,
          0
        )
      default:
        return 0
    }
  }

  switch (stage) {
    case "printed":
      return Number.MAX_SAFE_INTEGER
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
