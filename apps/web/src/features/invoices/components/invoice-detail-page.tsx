import { useState } from "react"

import { Link } from "@tanstack/react-router"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { getInvoiceShareLink } from "@/features/invoices/api/invoices-client"
import { useInvoiceQuery } from "@/features/invoices/hooks/use-invoices"
import { apiBaseUrl } from "@/lib/api"

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const currentUser = useCurrentUser()
  const invoiceQuery = useInvoiceQuery(invoiceId)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false)

  if (currentUser.data?.role !== "admin") {
    return (
      <Alert>
        <AlertDescription>Invoice visibility is restricted to admins.</AlertDescription>
      </Alert>
    )
  }

  const invoice = invoiceQuery.data ?? null

  async function handleCopyShareLink() {
    if (!invoice || isCreatingShareLink) {
      return
    }

    setIsCreatingShareLink(true)
    setShareMessage(null)
    setShareError(null)

    try {
      const shareLink = await getInvoiceShareLink(invoice.id)
      await navigator.clipboard.writeText(shareLink.url)
      setShareMessage(`Copied share link for ${shareLink.filename}.`)
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Unable to copy share link.")
    } finally {
      setIsCreatingShareLink(false)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Invoice Detail</CardTitle>
            <CardDescription>
              Review the persisted invoice snapshot. Structural changes do not happen here; unpaid corrections must be made on the linked order, and paid invoices stay locked.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/invoices">Back to invoices</Link>
            </Button>
            {invoice ? (
              <Button
                type="button"
                variant="outline"
                disabled={isCreatingShareLink}
                onClick={() => {
                  void handleCopyShareLink()
                }}
              >
                {isCreatingShareLink ? "Preparing link..." : "Copy share link"}
              </Button>
            ) : null}
            {invoice ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.open(`${apiBaseUrl}/invoices/${invoice.id}/pdf`, "_blank", "noopener,noreferrer")
                }}
              >
                Open PDF
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {invoiceQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full md:col-span-2" />
          </div>
        ) : null}

        {invoiceQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{invoiceQuery.error.message}</AlertDescription>
          </Alert>
        ) : null}

        {shareError ? (
          <Alert variant="destructive">
            <AlertDescription>{shareError}</AlertDescription>
          </Alert>
        ) : null}

        {shareMessage ? (
          <Alert>
            <AlertDescription>{shareMessage}</AlertDescription>
          </Alert>
        ) : null}

        {invoice ? (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              <Item variant="outline" size="sm" className="h-full flex-col items-stretch text-sm">
                <ItemContent className="gap-3">
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Invoice number</ItemDescription>
                    <ItemTitle className="text-sm font-medium normal-case">{invoice.invoice_number}</ItemTitle>
                  </div>
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Order reference</ItemDescription>
                    <span className="text-sm font-medium text-foreground">{invoice.order_number_snapshot}</span>
                  </div>
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Status</ItemDescription>
                    <div>
                      <Badge variant={invoiceStatusVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Created</ItemDescription>
                    <span className="text-sm text-foreground">{new Date(invoice.created_at).toLocaleString()}</span>
                  </div>
                </ItemContent>
              </Item>

              <Item variant="outline" size="sm" className="h-full flex-col items-stretch text-sm">
                <ItemContent className="gap-3">
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Customer</ItemDescription>
                    <span className="text-sm font-medium text-foreground">{invoice.customer.business_name}</span>
                    <ItemDescription>
                      {invoice.customer.contact_person ?? "No contact person"}
                    </ItemDescription>
                    <ItemDescription>
                      {invoice.customer.contact_number ?? "No contact number"}
                    </ItemDescription>
                  </div>
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Subtotal</ItemDescription>
                    <span className="text-sm font-medium text-foreground">{invoice.subtotal}</span>
                  </div>
                </ItemContent>
              </Item>
            </div>

            <div className="grid gap-2">
              <h2 className="text-sm font-medium">Invoice Items</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit price</TableHead>
                    <TableHead>Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description_snapshot}</TableCell>
                      <TableCell>{item.item_type}</TableCell>
                      <TableCell>{item.quantity.toLocaleString()}</TableCell>
                      <TableCell>{item.unit_price}</TableCell>
                      <TableCell>{item.line_total}</TableCell>
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

function invoiceStatusVariant(status: "pending" | "paid" | "void"): "default" | "secondary" | "destructive" {
  if (status === "paid") {
    return "default"
  }

  if (status === "void") {
    return "destructive"
  }

  return "secondary"
}
