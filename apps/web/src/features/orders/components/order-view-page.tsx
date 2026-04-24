import { useState } from "react"

import { Link } from "@tanstack/react-router"

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

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import type { Invoice, Order, OrderStatus } from "@/features/orders/api/orders-client"
import {
  useCancelOrderMutation,
  useGenerateOrderInvoiceMutation,
  useOrderInvoiceQuery,
  useOrderQuery,
} from "@/features/orders/hooks/use-orders"
import { apiBaseUrl } from "@/lib/api"

export function OrderViewPage({ orderId }: { orderId: string }) {
  const currentUser = useCurrentUser()
  const orderQuery = useOrderQuery(orderId)
  const isAdmin = currentUser.data?.role === "admin"
  const orderInvoiceQuery = useOrderInvoiceQuery(orderId, isAdmin)
  const generateOrderInvoiceMutation = useGenerateOrderInvoiceMutation()
  const cancelOrderMutation = useCancelOrderMutation()
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageSuccess, setPageSuccess] = useState<string | null>(null)

  const order = orderQuery.data ?? null

  async function handleCancelOrder() {
    setPageError(null)
    setPageSuccess(null)

    if (!order) {
      return
    }

    if (
      !window.confirm(
        `Cancel order ${order.order_number}? Unconsumed reservations will be released.`,
      )
    ) {
      return
    }

    try {
      const canceledOrder = await cancelOrderMutation.mutateAsync(order.id)
      setPageSuccess(
        `Canceled ${canceledOrder.order_number}. Unconsumed reservations were released by the API.`,
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

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle>Order Details</CardTitle>
            <CardDescription>
              View the order record, line items, and admin-only invoice actions without mixing them
              into fulfillment progress.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/orders">Back to orders</Link>
            </Button>
            {order ? (
              <Button asChild variant="outline">
                <Link to="/orders/$orderId/fulfillment" params={{ orderId: order.id }}>
                  Fulfillment
                </Link>
              </Button>
            ) : null}
            {order ? (
              <Button asChild variant="outline">
                <Link to="/orders/$orderId/edit" params={{ orderId: order.id }}>
                  Edit
                </Link>
              </Button>
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
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link to="/orders">Back</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={
                      cancelOrderMutation.isPending ||
                      order.status === "canceled" ||
                      order.status === "completed"
                    }
                    onClick={handleCancelOrder}
                  >
                    {cancelOrderMutation.isPending ? "Canceling..." : "Cancel order"}
                  </Button>
                </div>
              </div>
            </div>

            {isAdmin ? (
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
  const hasInvoice = Boolean(invoice)
  const canGenerate = !hasInvoice && orderStatus === "completed"
  const resolvedInvoice = invoice ?? null

  return (
    <div className="grid gap-3 border p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="font-medium">Invoice</p>
          <p className="text-muted-foreground">
            Admin-only snapshot generated from completed order line-item prices.
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
              window.open(`${apiBaseUrl}/invoices/${resolvedInvoice.id}/pdf`, "_blank", "noopener,noreferrer")
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
          {orderStatus === "completed"
            ? "No invoice generated yet."
            : "Invoice generation is only allowed after the order is completed."}
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
