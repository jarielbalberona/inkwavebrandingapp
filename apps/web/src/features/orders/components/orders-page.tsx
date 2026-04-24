import { useDeferredValue, useMemo, useState } from "react"

import { Link, useNavigate } from "@tanstack/react-router"
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd"
import { GripVertical, ShoppingCartIcon } from "lucide-react"

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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
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
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { Customer } from "@/features/customers/api/customers-client"
import { useCustomersQuery } from "@/features/customers/hooks/use-customers"
import type { Order, OrderStatus } from "@/features/orders/api/orders-client"
import {
  orderStatusOptions,
  useUpdateOrderPrioritiesMutation,
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
  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
    }),
    [status]
  )
  const ordersQuery = useOrdersQuery(query)
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
    <div className="grid gap-3">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
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

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Fulfillment status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as OrderStatus | "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
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
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="created_at">Creation date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3">
          {ordersQuery.isLoading ? <OrdersTableSkeleton /> : null}

          {ordersQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{ordersQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {!ordersQuery.isLoading &&
          !ordersQuery.isError &&
          sortedOrders.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingCartIcon />
                </EmptyMedia>
                <EmptyTitle>No orders found</EmptyTitle>
                <EmptyDescription>No orders match the current filters.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {!ordersQuery.isLoading && !ordersQuery.isError && sortedOrders.length > 0 ? (
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
                                    "inline-flex size-7 items-center justify-center border border-border bg-background text-muted-foreground",
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
                                  asChild
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
                                >
                                  <Link
                                    to="/orders/$orderId/fulfillment"
                                    params={{ orderId: order.id }}
                                  >
                                    Fulfillment Progress
                                  </Link>
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
          ) : null}
        </CardContent>
      </Card>

    </div>
  )
}

const ORDERS_SKEL_ROW_KEYS = ["o0", "o1", "o2", "o3", "o4", "o5", "o6", "o7"] as const

function OrdersTableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full max-w-lg" />
      <div className="space-y-1.5">
        {ORDERS_SKEL_ROW_KEYS.map((id) => (
          <Skeleton key={id} className="h-11 w-full" />
        ))}
      </div>
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
        <ComboboxContent>
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
