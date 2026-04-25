import { useState } from "react"

import { Link, Navigate } from "@tanstack/react-router"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
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

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { appPermissions, getDefaultAuthorizedRoute, hasPermission } from "@/features/auth/permissions"
import type { Invoice, Order, OrderStatus } from "@/features/orders/api/orders-client"
import { openInvoicePdfInNewTab } from "@/features/invoices/api/invoices-client"
import {
  useCancelOrderMutation,
  useArchiveOrderMutation,
  useGenerateOrderInvoiceMutation,
  useOrderInvoiceQuery,
  useOrderQuery,
} from "@/features/orders/hooks/use-orders"
import { formatMoneyValue } from "@/lib/money"

export function OrderViewPage({ orderId }: { orderId: string }) {
  const currentUser = useCurrentUser()
  const canViewOrders = hasPermission(currentUser.data, appPermissions.ordersView)
  const canManageOrders = hasPermission(currentUser.data, appPermissions.ordersManage)
  const canRecordFulfillment = hasPermission(
    currentUser.data,
    appPermissions.ordersFulfillmentRecord,
  )
  const orderQuery = useOrderQuery(orderId)
  const canViewInvoices = hasPermission(currentUser.data, appPermissions.invoicesView)
  const canManageInvoices = hasPermission(currentUser.data, appPermissions.invoicesManage)
  const orderInvoiceQuery = useOrderInvoiceQuery(orderId, canViewInvoices)
  const generateOrderInvoiceMutation = useGenerateOrderInvoiceMutation()
  const cancelOrderMutation = useCancelOrderMutation()
  const archiveOrderMutation = useArchiveOrderMutation()
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageSuccess, setPageSuccess] = useState<string | null>(null)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)

  const order = orderQuery.data ?? null
  const invoiceLockBlocksEdit =
    orderInvoiceQuery.data?.status === "paid" ||
    orderInvoiceQuery.data?.status === "void" ||
    Number(orderInvoiceQuery.data?.paid_amount ?? "0") > 0
  const canOpenEdit =
    canManageOrders &&
    order !== null &&
    order.status !== "canceled" &&
    order.status !== "completed" &&
    order.status !== "partial_released" &&
    order.archived_at === null &&
    !invoiceLockBlocksEdit

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canViewOrders) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== `/orders/${orderId}`) {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Order visibility requires order-view permission.</AlertDescription>
      </Alert>
    )
  }

  async function handleCancelOrder() {
    setPageError(null)
    setPageSuccess(null)

    if (!order) {
      return
    }

    try {
      const canceledOrder = await cancelOrderMutation.mutateAsync(order.id)
      setIsCancelDialogOpen(false)
      setPageSuccess(
        `Canceled ${canceledOrder.order_number}. Unconsumed reservations were released and any unpaid pending invoice was voided by the API.`,
      )
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to cancel order.")
    }
  }

  async function handleGenerateInvoice() {
    setPageError(null)
    setPageSuccess(null)

    if (!order) {
      return
    }

    try {
      const invoice = await generateOrderInvoiceMutation.mutateAsync(order.id)
      setPageSuccess(`Generated invoice ${invoice.invoice_number}.`)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to generate invoice.")
    }
  }

  async function handleArchiveOrder() {
    setPageError(null)
    setPageSuccess(null)

    if (!order) {
      return
    }

    try {
      const archivedOrder = await archiveOrderMutation.mutateAsync(order.id)
      setIsArchiveDialogOpen(false)
      setPageSuccess(`Archived ${archivedOrder.order_number}.`)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to archive order.")
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle>Order Details</CardTitle>
            <CardDescription>
              View the order record, line items, and permission-gated invoice actions without mixing
              them into fulfillment progress.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/orders">Back to orders</Link>
            </Button>
            {order ? (
              canRecordFulfillment ? (
                <Button asChild variant="outline">
                  <Link to="/orders/$orderId/fulfillment" params={{ orderId: order.id }}>
                    Fulfillment
                  </Link>
                </Button>
              ) : null
            ) : null}
            {order ? (
              canOpenEdit ? (
                <Button asChild variant="outline">
                  <Link to="/orders/$orderId/edit" params={{ orderId: order.id }}>
                    Edit
                  </Link>
                </Button>
              ) : (
                <Button type="button" variant="outline" disabled>
                  Edit locked
                </Button>
              )
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {orderQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading order...</p>
        ) : null}

        {orderQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{orderQuery.error.message}</AlertDescription>
          </Alert>
        ) : null}

        {pageError ? (
          <Alert variant="destructive">
            <AlertDescription>{pageError}</AlertDescription>
          </Alert>
        ) : null}

        {pageSuccess ? (
          <Alert>
            <AlertDescription>{pageSuccess}</AlertDescription>
          </Alert>
        ) : null}

        {order ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-3 border p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-muted-foreground">
                      Created {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={statusVariant(order.status)}>
                    {formatStatus(order.status)}
                  </Badge>
                  {order.archived_at ? (
                    <Badge variant="secondary">Archived</Badge>
                  ) : null}
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{order.customer.business_name}</p>
                  <p className="text-muted-foreground">
                    {order.customer.contact_person ?? "No contact person"}
                  </p>
                  <p className="text-muted-foreground">
                    {order.customer.contact_number ?? "No contact number"}
                  </p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p>{order.notes?.trim() ? order.notes : "No notes recorded."}</p>
                </div>
              </div>

              <div className="grid gap-3 border p-4 text-sm">
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Line items</p>
                  <p className="font-medium">{order.items.length.toLocaleString()}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Total quantity</p>
                  <p className="font-medium">{totalQuantity(order).toLocaleString()}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Last updated</p>
                  <p>{new Date(order.updated_at).toLocaleString()}</p>
                </div>
                {order.archived_at ? (
                  <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Archived</p>
                    <p>{new Date(order.archived_at).toLocaleString()}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link to="/orders">Back</Link>
                  </Button>
                  {canManageOrders ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={
                        cancelOrderMutation.isPending ||
                        order.status === "canceled" ||
                        order.status === "completed"
                      }
                      onClick={() => {
                        setIsCancelDialogOpen(true)
                      }}
                    >
                      {cancelOrderMutation.isPending ? "Canceling..." : "Cancel order"}
                    </Button>
                  ) : null}
                  {canManageOrders ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={
                        archiveOrderMutation.isPending ||
                        order.archived_at !== null ||
                        order.status !== "canceled"
                      }
                      onClick={() => {
                        setIsArchiveDialogOpen(true)
                      }}
                    >
                      {archiveOrderMutation.isPending ? "Archiving..." : "Archive order"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {canManageInvoices ? (
              <InvoicePanel
                invoice={orderInvoiceQuery.data}
                invoiceError={orderInvoiceQuery.isError ? orderInvoiceQuery.error.message : null}
                isGenerating={generateOrderInvoiceMutation.isPending}
                isLoading={orderInvoiceQuery.isLoading}
                onGenerate={handleGenerateInvoice}
                orderStatus={order.status}
              />
            ) : null}

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium">Line Items</h2>
                <Badge variant="secondary">{order.items.length} items</Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{formatOrderItemLabel(item)}</TableCell>
                      <TableCell>{item.item_type}</TableCell>
                      <TableCell>{formatOrderItemDetails(item)}</TableCell>
                      <TableCell>{item.quantity.toLocaleString()}</TableCell>
                      <TableCell>{item.notes?.trim() ? item.notes : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}
      </CardContent>
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order?</AlertDialogTitle>
            <AlertDialogDescription>
              {order
                ? `Cancel order ${order.order_number}? Unconsumed reservations will be released.`
                : "Cancel this order? Unconsumed reservations will be released."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelOrderMutation.isPending}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelOrderMutation.isPending}
              onClick={() => {
                void handleCancelOrder()
              }}
            >
              {cancelOrderMutation.isPending ? "Canceling..." : "Cancel order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive order?</AlertDialogTitle>
            <AlertDialogDescription>
              {order
                ? `Archive order ${order.order_number}? It will be hidden from the orders table unless archived orders are shown.`
                : "Archive this order? It will be hidden from the orders table unless archived orders are shown."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveOrderMutation.isPending}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={archiveOrderMutation.isPending || !order}
              onClick={() => {
                void handleArchiveOrder()
              }}
            >
              {archiveOrderMutation.isPending ? "Archiving..." : "Archive order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
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
  const [pdfOpenError, setPdfOpenError] = useState<string | null>(null)
  const hasInvoice = Boolean(invoice)
  const canGenerate = !hasInvoice && orderStatus !== "canceled"
  const resolvedInvoice = invoice ?? null

  return (
    <div className="grid gap-3 border p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="font-medium">Invoice</p>
          <p className="text-muted-foreground">
            Admin-only financial snapshot. While no payment has been recorded, structural changes must go through the order. Once payment starts, or once it is paid or voided, structural edits are locked.
          </p>
        </div>
        {canGenerate ? (
          <Button type="button" size="sm" variant="outline" disabled={isGenerating} onClick={() => void onGenerate()}>
            {isGenerating ? "Generating..." : "Generate invoice"}
          </Button>
        ) : null}
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading invoice state...</p> : null}

      {resolvedInvoice ? (
        <div className="grid gap-2 md:grid-cols-4">
          <div className="border p-3">
            <p className="text-xs text-muted-foreground">Invoice number</p>
            <p className="font-medium">{resolvedInvoice.invoice_number}</p>
          </div>
          <div className="border p-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={invoiceStatusVariant(resolvedInvoice.status)}>
              {formatStatus(resolvedInvoice.status)}
            </Badge>
          </div>
          <div className="border p-3">
            <p className="text-xs text-muted-foreground">Subtotal</p>
            <p className="font-medium">{formatMoneyValue(resolvedInvoice.subtotal)}</p>
          </div>
          <div className="border p-3">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="font-medium">{formatMoneyValue(resolvedInvoice.paid_amount)}</p>
          </div>
          <div className="border p-3">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="font-medium">{formatMoneyValue(resolvedInvoice.remaining_balance)}</p>
          </div>
          <div className="border p-3">
            <p className="text-xs text-muted-foreground">Generated</p>
            <p className="font-medium">{new Date(resolvedInvoice.created_at).toLocaleString()}</p>
          </div>
        </div>
      ) : null}

      {pdfOpenError ? <p className="text-sm text-destructive">{pdfOpenError}</p> : null}

      {resolvedInvoice ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" size="sm" variant="outline">
            <Link to="/invoices/$invoiceId" params={{ invoiceId: resolvedInvoice.id }}>
              Open invoice
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setPdfOpenError(null)
              void openInvoicePdfInNewTab(resolvedInvoice.id).catch((error) => {
                setPdfOpenError(
                  error instanceof Error ? error.message : "Unable to open the PDF.",
                )
              })
            }}
          >
            Open PDF
          </Button>
        </div>
      ) : invoiceError ? (
        <p className="text-muted-foreground">
          {invoiceError === "No invoice has been generated for this order yet."
            ? "No invoice generated yet."
            : invoiceError}
        </p>
      ) : (
        <p className="text-muted-foreground">
          {orderStatus === "canceled"
            ? "Canceled orders should not generate a new invoice."
            : "No invoice snapshot exists yet. Admins can backfill it from the current order state."}
        </p>
      )}
    </div>
  )
}

function formatStatus(status: string): string {
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

function invoiceStatusVariant(status: Invoice["status"]): "default" | "secondary" | "destructive" {
  if (status === "paid") {
    return "default"
  }

  if (status === "void") {
    return "destructive"
  }

  return "secondary"
}

function totalQuantity(order: Order): number {
  return order.items.reduce((total, item) => total + item.quantity, 0)
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
