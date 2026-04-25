import { useDeferredValue, useState } from "react"

import { Link, Navigate, useNavigate } from "@tanstack/react-router"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { formatCurrency } from "@workspace/ui/lib/number"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import type { InvoiceListItem } from "@/features/invoices/api/invoices-client"
import { appPermissions, getDefaultAuthorizedRoute, hasPermission } from "@/features/auth/permissions"
import { useInvoicesQuery } from "@/features/invoices/hooks/use-invoices"
import { formatMoneyValue } from "@/lib/money"

export function InvoicesPage() {
  const currentUser = useCurrentUser()
  const navigate = useNavigate()
  const canViewInvoices = hasPermission(currentUser.data, appPermissions.invoicesView)
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const invoicesOverviewQuery = useInvoicesQuery()
  const invoicesQuery = useInvoicesQuery({ search: deferredSearch })

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canViewInvoices) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/invoices") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Invoice visibility requires invoice-view permission.</AlertDescription>
      </Alert>
    )
  }

  function navigateToInvoice(invoiceId: string) {
    void navigate({ to: "/invoices/$invoiceId", params: { invoiceId } })
  }

  const overview = summarizeInvoices(invoicesOverviewQuery.data ?? [])

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="grid gap-1">
          <CardTitle>Invoices</CardTitle>
        </div>

        {invoicesOverviewQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{invoicesOverviewQuery.error.message}</AlertDescription>
          </Alert>
        ) : null}

        {invoicesOverviewQuery.isLoading ? (
          <InvoiceOverviewSkeleton />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total invoices"
              value={overview.totalInvoices.toLocaleString()}
              description={`${overview.pendingInvoices.toLocaleString()} pending, ${overview.paidInvoices.toLocaleString()} paid, ${overview.voidInvoices.toLocaleString()} void.`}
            />
            <MetricCard
              label="Total billed"
              value={formatCurrency(overview.totalBilled)}
              description="Gross invoice amount across every non-filtered invoice on this page load."
            />
            <MetricCard
              label="Payments collected"
              value={formatCurrency(overview.totalCollected)}
              description="Recorded payments only. If it is not in invoice payments, it does not count."
            />
            <MetricCard
              label="Pending balance"
              value={formatCurrency(overview.totalOutstanding)}
              description="Open receivables still sitting on pending invoices."
            />
          </div>
        )}

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
              <TableHead>Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoicesQuery.data?.map((invoice) => (
              <TableRow
                key={invoice.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => navigateToInvoice(invoice.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    navigateToInvoice(invoice.id)
                  }
                }}
              >
                <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                <TableCell>{invoice.order_number_snapshot}</TableCell>
                <TableCell>{invoice.customer.business_name}</TableCell>
                <TableCell>{formatMoneyValue(invoice.subtotal)}</TableCell>
                <TableCell>{formatMoneyValue(invoice.paid_amount)}</TableCell>
                <TableCell>{formatMoneyValue(invoice.remaining_balance)}</TableCell>
                <TableCell>{new Date(invoice.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
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

function summarizeInvoices(invoices: InvoiceListItem[]) {
  return invoices.reduce(
    (summary, invoice) => {
      const totalAmount = Number(invoice.total_amount)
      const paidAmount = Number(invoice.paid_amount)
      const remainingBalance = Number(invoice.remaining_balance)

      summary.totalInvoices += 1
      summary.totalBilled += Number.isFinite(totalAmount) ? totalAmount : 0
      summary.totalCollected += Number.isFinite(paidAmount) ? paidAmount : 0
      summary.totalOutstanding += Number.isFinite(remainingBalance) ? remainingBalance : 0

      if (invoice.status === "paid") {
        summary.paidInvoices += 1
      } else if (invoice.status === "void") {
        summary.voidInvoices += 1
      } else {
        summary.pendingInvoices += 1
      }

      return summary
    },
    {
      totalInvoices: 0,
      pendingInvoices: 0,
      paidInvoices: 0,
      voidInvoices: 0,
      totalBilled: 0,
      totalCollected: 0,
      totalOutstanding: 0,
    },
  )
}

function MetricCard({
  description,
  label,
  value,
}: {
  description: string
  label: string
  value: string
}) {
  return (
    <Card size="sm">
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function InvoiceOverviewSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {["invoice-metric-0", "invoice-metric-1", "invoice-metric-2", "invoice-metric-3"].map((key) => (
        <Card key={key} size="sm">
          <CardHeader className="gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-8 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
