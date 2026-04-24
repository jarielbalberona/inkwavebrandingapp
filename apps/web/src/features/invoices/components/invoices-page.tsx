import { useDeferredValue, useState } from "react"

import { Link } from "@tanstack/react-router"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { useInvoicesQuery } from "@/features/invoices/hooks/use-invoices"

export function InvoicesPage() {
  const currentUser = useCurrentUser()
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const invoicesQuery = useInvoicesQuery({ search: deferredSearch })

  if (currentUser.data?.role !== "admin") {
    return (
      <Alert>
        <AlertDescription>Invoice visibility is restricted to admins.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="grid gap-1">
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            Review generated invoice snapshots and open the persisted PDF from a dedicated invoice surface.
          </CardDescription>
        </div>

        <div className="grid gap-2 md:max-w-sm">
          <Label htmlFor="invoice-search">Search invoices</Label>
          <Input
            id="invoice-search"
            value={search}
            placeholder="Search invoice number, order number, or customer"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {invoicesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading invoices...</p>
        ) : null}

        {invoicesQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{invoicesQuery.error.message}</AlertDescription>
          </Alert>
        ) : null}

        {!invoicesQuery.isLoading && !invoicesQuery.isError && (invoicesQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices match the current filters.</p>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Subtotal</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoicesQuery.data?.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                <TableCell>{invoice.order_number_snapshot}</TableCell>
                <TableCell>{invoice.customer.business_name}</TableCell>
                <TableCell>{invoice.subtotal}</TableCell>
                <TableCell>{new Date(invoice.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link to="/invoices/$invoiceId" params={{ invoiceId: invoice.id }}>
                      View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
