import { useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Link, Navigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { DatePicker } from "@workspace/ui/components/date-picker"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
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
import { appPermissions, getDefaultAuthorizedRoute, hasPermission } from "@/features/auth/permissions"
import { getInvoiceShareLink } from "@/features/invoices/api/invoices-client"
import {
  useInvoiceQuery,
  useRecordInvoicePaymentMutation,
  useVoidInvoiceMutation,
} from "@/features/invoices/hooks/use-invoices"
import { apiBaseUrl } from "@/lib/api"

const paymentFormSchema = z.object({
  amount: z
    .number()
    .nullable()
    .refine((value) => value !== null && value > 0, "Payment amount must be greater than zero."),
  payment_date: z.date(),
  note: z.string().trim().max(1000).optional(),
})

type PaymentFormValues = z.infer<typeof paymentFormSchema>

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const currentUser = useCurrentUser()
  const canViewInvoices = hasPermission(currentUser.data, appPermissions.invoicesView)
  const canManageInvoices = hasPermission(currentUser.data, appPermissions.invoicesManage)
  const invoiceQuery = useInvoiceQuery(invoiceId)
  const recordInvoicePaymentMutation = useRecordInvoicePaymentMutation()
  const voidInvoiceMutation = useVoidInvoiceMutation()
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false)

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: null,
      payment_date: new Date(),
      note: "",
    },
  })

  if (!canViewInvoices) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== `/invoices/${invoiceId}`) {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Invoice visibility requires invoice-view permission.</AlertDescription>
      </Alert>
    )
  }

  const invoice = invoiceQuery.data ?? null
  const canRecordPayment =
    canManageInvoices && invoice !== null && invoice.status !== "paid" && invoice.status !== "void"
  const canVoidInvoice =
    canManageInvoices &&
    invoice !== null &&
    invoice.status === "pending" &&
    Number(invoice.paid_amount) === 0 &&
    !voidInvoiceMutation.isPending
  const paymentLockStarted = invoice !== null && Number(invoice.paid_amount) > 0

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

  async function handleRecordPayment(values: PaymentFormValues) {
    if (!invoice || !canRecordPayment) {
      return
    }

    setActionError(null)
    setActionMessage(null)

    try {
      const updatedInvoice = await recordInvoicePaymentMutation.mutateAsync({
        invoiceId: invoice.id,
        payload: {
          amount: (values.amount ?? 0).toFixed(2),
          payment_date: values.payment_date.toISOString(),
          note: values.note?.trim() ? values.note.trim() : undefined,
        },
      })

      paymentForm.reset({
        amount: null,
        payment_date: new Date(),
        note: "",
      })
      setActionMessage(
        updatedInvoice.status === "paid"
          ? `Recorded payment and settled ${updatedInvoice.invoice_number}.`
          : `Recorded payment for ${updatedInvoice.invoice_number}.`,
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to record payment.")
    }
  }

  async function handleVoidInvoice() {
    if (!invoice || !canVoidInvoice) {
      return
    }

    setActionError(null)
    setActionMessage(null)

    try {
      const updatedInvoice = await voidInvoiceMutation.mutateAsync(invoice.id)
      setIsVoidDialogOpen(false)
      setActionMessage(`Voided ${updatedInvoice.invoice_number}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to void invoice.")
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Invoice Detail</CardTitle>
            <CardDescription>
              Structural invoice content stays read-only here. Payment actions only change financial state, and any recorded payment locks structural order edits.
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
      <CardContent className="grid gap-4">
        {invoiceQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full md:col-span-2 xl:col-span-3" />
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

        {actionError ? (
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        {actionMessage ? (
          <Alert>
            <AlertDescription>{actionMessage}</AlertDescription>
          </Alert>
        ) : null}

        {invoice ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                      <Badge variant={invoiceStatusVariant(invoice.status)}>{invoice.status}</Badge>
                    </div>
                  </div>
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Created</ItemDescription>
                    <span className="text-sm text-foreground">{new Date(invoice.created_at).toLocaleString()}</span>
                  </div>
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Due date</ItemDescription>
                    <span className="text-sm text-foreground">
                      {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "No due date set"}
                    </span>
                  </div>
                </ItemContent>
              </Item>

              <Item variant="outline" size="sm" className="h-full flex-col items-stretch text-sm">
                <ItemContent className="gap-3">
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Customer</ItemDescription>
                    <span className="text-sm font-medium text-foreground">{invoice.customer.business_name}</span>
                    <ItemDescription>{invoice.customer.contact_person ?? "No contact person"}</ItemDescription>
                    <ItemDescription>{invoice.customer.contact_number ?? "No contact number"}</ItemDescription>
                    <ItemDescription>{invoice.customer.email ?? "No email recorded"}</ItemDescription>
                  </div>
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Address</ItemDescription>
                    <span className="text-sm text-foreground">{invoice.customer.address ?? "No address recorded"}</span>
                  </div>
                </ItemContent>
              </Item>

              <Item variant="outline" size="sm" className="h-full flex-col items-stretch text-sm">
                <ItemContent className="gap-3">
                  <FinancialRow label="Subtotal" value={invoice.subtotal} />
                  <FinancialRow label="Total" value={invoice.total_amount} />
                  <FinancialRow label="Paid" value={invoice.paid_amount} />
                  <FinancialRow label="Remaining" value={invoice.remaining_balance} emphasized />
                  <div className="grid gap-0.5">
                    <ItemDescription className="text-xs">Notes</ItemDescription>
                    <span className="text-sm text-foreground">{invoice.notes?.trim() ? invoice.notes : "No invoice notes recorded."}</span>
                  </div>
                </ItemContent>
              </Item>
            </div>

            {paymentLockStarted ? (
              <Alert>
                <AlertDescription>
                  Payment activity has started on this invoice. Structural order edits are now locked and additional billable work should move to a new order and a new invoice.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-medium">Payment history</h2>
                  <Badge variant="secondary">{invoice.payments.length} entries</Badge>
                </div>
                <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline">
                      Payment actions
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Payment actions</DialogTitle>
                      <DialogDescription>
                        Record real payments here. This does not edit invoice line items or totals.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                      <Form {...paymentForm}>
                        <form className="grid gap-4" onSubmit={paymentForm.handleSubmit(handleRecordPayment)}>
                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                              control={paymentForm.control}
                              name="amount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Payment amount</FormLabel>
                                  <FormControl>
                                    <Input.Currency
                                      disabled={!canRecordPayment || recordInvoicePaymentMutation.isPending}
                                      min={0}
                                      value={field.value ?? undefined}
                                      onChange={(value) => field.onChange(value)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={paymentForm.control}
                              name="payment_date"
                              render={({ field }) => (
                                <FormItem className="grid gap-2">
                                  <FormLabel>Payment date</FormLabel>
                                  <FormControl>
                                    <DatePicker
                                      disabled={!canRecordPayment || recordInvoicePaymentMutation.isPending}
                                      value={field.value}
                                      onSelect={(date) => field.onChange(date ?? new Date())}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={paymentForm.control}
                            name="note"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Payment note</FormLabel>
                                <FormControl>
                                  <Textarea
                                    disabled={!canRecordPayment || recordInvoicePaymentMutation.isPending}
                                    placeholder="Reference number, payment channel, or short admin note"
                                    value={field.value ?? ""}
                                    onChange={field.onChange}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="submit"
                              disabled={!canRecordPayment || recordInvoicePaymentMutation.isPending}
                            >
                              {recordInvoicePaymentMutation.isPending ? "Recording..." : "Record payment"}
                            </Button>
                            {!canRecordPayment ? (
                              <Button type="button" variant="outline" disabled>
                                Payments locked
                              </Button>
                            ) : null}
                          </div>
                        </form>
                      </Form>

                      <div className="grid gap-3 rounded-md border p-4 text-sm">
                        <div className="grid gap-1">
                          <p className="font-medium">Invoice state</p>
                          <p className="text-muted-foreground">
                            {invoice.status === "void"
                              ? "Void invoices cannot accept payments."
                              : invoice.status === "paid"
                                ? "This invoice is fully settled."
                                : paymentLockStarted
                                  ? "Partial payment recorded. Structural order edits are locked."
                                  : "No payment recorded yet. Structural changes still belong on the linked order."}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={!canVoidInvoice}
                          onClick={() => {
                            setIsVoidDialogOpen(true)
                          }}
                        >
                          {voidInvoiceMutation.isPending ? "Voiding..." : "Void invoice"}
                        </Button>
                        {!canVoidInvoice ? (
                          <p className="text-muted-foreground">
                            {invoice.status === "void"
                              ? "Already void."
                              : Number(invoice.paid_amount) > 0
                                ? "Void is disabled once any payment has been recorded."
                                : "Void is only available for unpaid pending invoices."}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {invoice.payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Recorded by</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{new Date(payment.payment_date).toLocaleString()}</TableCell>
                        <TableCell className="font-medium">{payment.amount}</TableCell>
                        <TableCell>{payment.created_by?.display_name ?? payment.created_by?.email ?? "Unknown user"}</TableCell>
                        <TableCell>{payment.note?.trim() ? payment.note : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No payments have been recorded yet.</p>
              )}
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
      <AlertDialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoice
                ? `Void invoice ${invoice.invoice_number}? This cannot be undone from the current UI.`
                : "Void this invoice? This cannot be undone from the current UI."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voidInvoiceMutation.isPending}>Keep invoice</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={voidInvoiceMutation.isPending}
              onClick={() => {
                void handleVoidInvoice()
              }}
            >
              {voidInvoiceMutation.isPending ? "Voiding..." : "Void invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function FinancialRow({
  label,
  value,
  emphasized = false,
}: {
  label: string
  value: string
  emphasized?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <ItemDescription className="text-xs">{label}</ItemDescription>
      <span className={emphasized ? "text-sm font-semibold text-foreground" : "text-sm font-medium text-foreground"}>
        {value}
      </span>
    </div>
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
