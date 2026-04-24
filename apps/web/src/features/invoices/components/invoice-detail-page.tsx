import { Link } from "@tanstack/react-router"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { useInvoiceQuery } from "@/features/invoices/hooks/use-invoices"
import { apiBaseUrl } from "@/lib/api"

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const currentUser = useCurrentUser()
  const invoiceQuery = useInvoiceQuery(invoiceId)

  if (currentUser.data?.role !== "admin") {
    return (
      <Alert>
        <AlertDescription>Invoice visibility is restricted to admins.</AlertDescription>
      </Alert>
    )
  }

  const invoice = invoiceQuery.data ?? null

  return (
    <Card className="rounded-none">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle>Invoice Detail</CardTitle>
            <CardDescription>
              Review the persisted invoice snapshot and open the shared PDF rendering path.
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
      <CardContent className="grid gap-5">
        {invoiceQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading invoice...</p>
        ) : null}

        {invoiceQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{invoiceQuery.error.message}</AlertDescription>
          </Alert>
        ) : null}

        {invoice ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-3 border p-4 text-sm">
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Invoice number</p>
                  <p className="font-medium">{invoice.invoice_number}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Order reference</p>
                  <p className="font-medium">{invoice.order_number_snapshot}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p>{new Date(invoice.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid gap-3 border p-4 text-sm">
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{invoice.customer.business_name}</p>
                  <p className="text-muted-foreground">
                    {invoice.customer.contact_person ?? "No contact person"}
                  </p>
                  <p className="text-muted-foreground">
                    {invoice.customer.contact_number ?? "No contact number"}
                  </p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="font-medium">{invoice.subtotal}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
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
