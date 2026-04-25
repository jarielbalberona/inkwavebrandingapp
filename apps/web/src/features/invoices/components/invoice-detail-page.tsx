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
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
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
import type { Invoice, InvoiceShareLink } from "@/features/invoices/api/invoices-client"
import { useOrderQuery } from "@/features/orders/hooks/use-orders"
import {
  useArchiveInvoiceMutation,
  useDeleteInvoicePaymentMutation,
  useInvoiceQuery,
  useInvoiceShareLinkMutation,
  useRecordInvoicePaymentMutation,
  useUpdateInvoicePaymentMutation,
  useVoidInvoiceMutation,
} from "@/features/invoices/hooks/use-invoices"
import { formatMoneyValue } from "@/lib/money"
import { ArrowLeftIcon, CopyIcon, EyeIcon, PencilIcon, Trash2Icon } from "lucide-react"

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
  const linkedOrderQuery = useOrderQuery(invoiceQuery.data?.order_id ?? null)
  const recordInvoicePaymentMutation = useRecordInvoicePaymentMutation()
  const updateInvoicePaymentMutation = useUpdateInvoicePaymentMutation()
  const deleteInvoicePaymentMutation = useDeleteInvoicePaymentMutation()
  const voidInvoiceMutation = useVoidInvoiceMutation()
  const archiveInvoiceMutation = useArchiveInvoiceMutation()
  const shareLinkMutation = useInvoiceShareLinkMutation()
  const [shareLinkState, setShareLinkState] = useState<{
    invoiceId: string
    shareLink: InvoiceShareLink
  } | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [isManualShareDialogOpen, setIsManualShareDialogOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false)
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: null,
      payment_date: new Date(),
      note: "",
    },
  })
  const shareLink = shareLinkState?.invoiceId === invoiceId ? shareLinkState.shareLink : null

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

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
  const canMutatePayments = canManageInvoices && invoice !== null && invoice.status !== "void"
  const hasNoInvoicePayments =
    invoice !== null && Number(invoice.paid_amount) === 0 && invoice.payments.length === 0
  const linkedOrderCanceled = linkedOrderQuery.data?.status === "canceled"
  const linkedOrderGateReady = !linkedOrderQuery.isLoading && !linkedOrderQuery.isError
  const canVoidInvoice =
    canManageInvoices &&
    invoice !== null &&
    invoice.status === "pending" &&
    hasNoInvoicePayments &&
    linkedOrderGateReady &&
    linkedOrderCanceled &&
    !voidInvoiceMutation.isPending
  const canArchiveInvoice =
    canManageInvoices &&
    invoice !== null &&
    invoice.status === "void" &&
    invoice.archived_at === null &&
    !archiveInvoiceMutation.isPending
  const editingPayment = invoice?.payments.find((payment) => payment.id === editingPaymentId) ?? null
  const deletingPayment = invoice?.payments.find((payment) => payment.id === deletingPaymentId) ?? null
  const paymentLockStarted = invoice !== null && Number(invoice.paid_amount) > 0

  function openCreatePaymentDialog() {
    setEditingPaymentId(null)
    paymentForm.reset({
      amount: null,
      payment_date: new Date(),
      note: "",
    })
    setIsPaymentDialogOpen(true)
  }

  function openEditPaymentDialog(payment: NonNullable<typeof invoice>["payments"][number]) {
    setEditingPaymentId(payment.id)
    paymentForm.reset({
      amount: Number(payment.amount),
      payment_date: new Date(payment.payment_date),
      note: payment.note ?? "",
    })
    setIsPaymentDialogOpen(true)
  }

  async function resolveShareLink(): Promise<InvoiceShareLink> {
    if (!invoice) {
      throw new Error("Invoice data is not available yet.")
    }

    if (shareLink) {
      return shareLink
    }

    const nextShareLink = await shareLinkMutation.mutateAsync(invoice.id)
    setShareLinkState({ invoiceId: invoice.id, shareLink: nextShareLink })
    return nextShareLink
  }

  async function handleCopyShareLink() {
    if (!invoice || shareLinkMutation.isPending) {
      return
    }

    setShareMessage(null)
    setShareError(null)

    let resolvedShareLink: InvoiceShareLink | null = null

    try {
      const nextShareLink = await resolveShareLink()
      resolvedShareLink = nextShareLink

      if (!navigator.clipboard?.writeText) {
        setIsManualShareDialogOpen(true)
        setShareError("Clipboard access is unavailable. Copy the invoice link manually.")
        return
      }

      await navigator.clipboard.writeText(nextShareLink.url)
      setIsManualShareDialogOpen(false)
      setShareMessage(`Copied share link for ${nextShareLink.filename}.`)
    } catch (error) {
      if (resolvedShareLink ?? shareLink) {
        setIsManualShareDialogOpen(true)
        setShareError("Clipboard copy failed. Copy the invoice link manually.")
        return
      }

      setShareError(error instanceof Error ? error.message : "Unable to copy share link.")
    }
  }

  async function handleViewPdf() {
    if (!invoice || shareLinkMutation.isPending) {
      return
    }

    setShareMessage(null)
    setShareError(null)

    const child = window.open("", "_blank")

    if (!child) {
      setShareError("Your browser blocked the PDF tab. Allow pop-ups for this site, then try again.")
      return
    }

    child.opener = null

    try {
      const nextShareLink = await resolveShareLink()
      child.location.href = nextShareLink.url
      setShareMessage(`Opened ${nextShareLink.filename}.`)
    } catch (error) {
      child.close()
      setShareError(error instanceof Error ? error.message : "Unable to open the invoice PDF.")
    }
  }

  async function handleRecordPayment(values: PaymentFormValues) {
    if (!invoice || !canManageInvoices) {
      return
    }

    setActionError(null)
    setActionMessage(null)

    try {
      const payload = {
        amount: (values.amount ?? 0).toFixed(2),
        payment_date: values.payment_date.toISOString(),
        note: values.note?.trim() ? values.note.trim() : undefined,
      }

      const updatedInvoice = editingPaymentId
        ? await updateInvoicePaymentMutation.mutateAsync({
            invoiceId: invoice.id,
            paymentId: editingPaymentId,
            payload,
          })
        : await recordInvoicePaymentMutation.mutateAsync({
            invoiceId: invoice.id,
            payload,
          })

      paymentForm.reset({
        amount: null,
        payment_date: new Date(),
        note: "",
      })
      setEditingPaymentId(null)
      setIsPaymentDialogOpen(false)
      setActionMessage(
        editingPaymentId
          ? `Updated payment for ${updatedInvoice.invoice_number}.`
          : updatedInvoice.status === "paid"
            ? `Recorded payment and settled ${updatedInvoice.invoice_number}.`
            : `Recorded payment for ${updatedInvoice.invoice_number}.`,
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save payment.")
    }
  }

  async function handleDeletePayment() {
    if (!invoice || !deletingPaymentId) {
      return
    }

    setActionError(null)
    setActionMessage(null)

    try {
      const updatedInvoice = await deleteInvoicePaymentMutation.mutateAsync({
        invoiceId: invoice.id,
        paymentId: deletingPaymentId,
      })
      setDeletingPaymentId(null)
      setActionMessage(`Deleted payment from ${updatedInvoice.invoice_number}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete payment.")
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

  async function handleArchiveInvoice() {
    if (!invoice || !canArchiveInvoice) {
      return
    }

    setActionError(null)
    setActionMessage(null)

    try {
      const updatedInvoice = await archiveInvoiceMutation.mutateAsync(invoice.id)
      setIsArchiveDialogOpen(false)
      setActionMessage(`Archived ${updatedInvoice.invoice_number}. It no longer appears in the default invoice table.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to archive invoice.")
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Invoice Detail</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/invoices"><ArrowLeftIcon className="size-4" />Invoices</Link>
            </Button>
            {invoice ? (
              <Button
                type="button"
                variant="outline"
                disabled={shareLinkMutation.isPending}
                size="sm"
                onClick={() => {
                  void handleCopyShareLink()
                }}
              >
                <CopyIcon className="size-4" />
                {shareLinkMutation.isPending ? "Copying..." : "Link"}
              </Button>
            ) : null}
            {invoice ? (
              <Button
                type="button"
                variant="outline"
                disabled={shareLinkMutation.isPending}
                size="sm"
                onClick={() => {
                  void handleViewPdf()
                }}
              >
                <EyeIcon className="size-4" />
                PDF
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

        {shareLink ? (
          <div className="grid gap-2 rounded-md border p-3">
            <label htmlFor="invoice-share-link" className="text-xs font-medium text-muted-foreground">
              Invoice share link
            </label>
            <Input id="invoice-share-link" readOnly value={shareLink.url} onFocus={(event) => event.target.select()} />
          </div>
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
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={invoiceStatusVariant(invoice.status)}>{invoice.status}</Badge>
                      {invoice.archived_at ? <Badge variant="outline">archived</Badge> : null}
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
                  <Button type="button" variant="outline" onClick={openCreatePaymentDialog}>
                    Payment actions
                  </Button>
                  <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editingPayment ? "Update payment" : "Payment actions"}</DialogTitle>
                      <DialogDescription>
                        {editingPayment
                          ? "Correct the selected payment line. Invoice paid and balance totals will be recalculated."
                          : "Record real payments here. This does not edit invoice line items or totals."}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid">
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
                                      disabled={
                                        !canMutatePayments ||
                                        recordInvoicePaymentMutation.isPending ||
                                        updateInvoicePaymentMutation.isPending
                                      }
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
                                      disabled={
                                        !canMutatePayments ||
                                        recordInvoicePaymentMutation.isPending ||
                                        updateInvoicePaymentMutation.isPending
                                      }
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
                                    disabled={
                                      !canMutatePayments ||
                                      recordInvoicePaymentMutation.isPending ||
                                      updateInvoicePaymentMutation.isPending
                                    }
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
                              disabled={
                                (!editingPayment && !canRecordPayment) ||
                                (editingPayment !== null && !canMutatePayments) ||
                                recordInvoicePaymentMutation.isPending ||
                                updateInvoicePaymentMutation.isPending
                              }
                            >
                              {recordInvoicePaymentMutation.isPending || updateInvoicePaymentMutation.isPending
                                ? "Saving..."
                                : editingPayment
                                  ? "Update payment"
                                  : "Record payment"}
                            </Button>
                            {editingPayment ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={updateInvoicePaymentMutation.isPending}
                                onClick={openCreatePaymentDialog}
                              >
                                New payment
                              </Button>
                            ) : null}
                            {!editingPayment && !canRecordPayment ? (
                              <Button type="button" variant="outline" disabled>
                                Payments locked
                              </Button>
                            ) : null}
                          </div>
                        </form>
                      </Form>
                    </div>
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
                              : !hasNoInvoicePayments
                                ? "Void is disabled once any payment has been recorded."
                                : linkedOrderQuery.isLoading
                                  ? "Checking linked order…"
                                  : linkedOrderQuery.isError
                                    ? "Could not load the linked order. Refresh and try again."
                                    : linkedOrderQuery.data && linkedOrderQuery.data.status !== "canceled"
                                      ? (
                                          <>
                                            Cancel the linked order before voiding this invoice.{" "}
                                            <Link
                                              to="/orders/$orderId"
                                              params={{ orderId: invoice.order_id }}
                                              className="font-medium text-foreground underline"
                                            >
                                              Open order
                                            </Link>
                                            .
                                          </>
                                        )
                                      : "Void is only available for unpaid pending invoices whose linked order is canceled."}
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!canArchiveInvoice}
                          onClick={() => {
                            setIsArchiveDialogOpen(true)
                          }}
                        >
                          {archiveInvoiceMutation.isPending ? "Archiving..." : "Archive invoice"}
                        </Button>
                        {!canArchiveInvoice ? (
                          <p className="text-muted-foreground">
                            {invoice.archived_at
                              ? "Already archived."
                              : invoice.status !== "void"
                                ? "Only void invoices can be archived."
                                : "Archive requires invoice-manage permission."}
                          </p>
                        ) : null}
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{new Date(payment.payment_date).toLocaleString()}</TableCell>
                        <TableCell className="font-medium">{formatMoneyValue(payment.amount)}</TableCell>
                        <TableCell>{payment.created_by?.display_name ?? payment.created_by?.email ?? "Unknown user"}</TableCell>
                        <TableCell>{payment.note?.trim() ? payment.note : "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!canMutatePayments}
                              onClick={() => openEditPaymentDialog(payment)}
                            >
                              <PencilIcon className="size-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={!canMutatePayments || deleteInvoicePaymentMutation.isPending}
                              onClick={() => setDeletingPaymentId(payment.id)}
                            >
                              <Trash2Icon className="size-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
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
                      <TableCell>{formatInvoiceItemType(item.item_type)}</TableCell>
                      <TableCell>{item.quantity.toLocaleString()}</TableCell>
                      <TableCell>{formatMoneyValue(item.unit_price)}</TableCell>
                      <TableCell>{formatMoneyValue(item.line_total)}</TableCell>
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
      <Dialog open={isManualShareDialogOpen && Boolean(shareLink)} onOpenChange={setIsManualShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy invoice link manually</DialogTitle>
            <DialogDescription>
              Clipboard access failed. Select the link and copy it from the field below.
            </DialogDescription>
          </DialogHeader>
          <Input
            readOnly
            value={shareLink?.url ?? ""}
            onFocus={(event) => event.target.select()}
          />
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deletingPaymentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingPaymentId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingPayment
                ? `Delete the ${formatMoneyValue(deletingPayment.amount)} payment from ${new Date(deletingPayment.payment_date).toLocaleString()}? Invoice paid and balance totals will be recalculated.`
                : "Delete this payment? Invoice paid and balance totals will be recalculated."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInvoicePaymentMutation.isPending}>
              Keep payment
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteInvoicePaymentMutation.isPending}
              onClick={() => {
                void handleDeletePayment()
              }}
            >
              {deleteInvoicePaymentMutation.isPending ? "Deleting..." : "Delete payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoice
                ? `Archive ${invoice.invoice_number}? It must already be void. It will be hidden from the default invoice table, but it is not deleted.`
                : "Archive this invoice? It must already be void. It will be hidden from the default invoice table, but it is not deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveInvoiceMutation.isPending}>Keep invoice</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiveInvoiceMutation.isPending}
              onClick={() => {
                void handleArchiveInvoice()
              }}
            >
              {archiveInvoiceMutation.isPending ? "Archiving..." : "Archive invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function formatInvoiceItemType(itemType: Invoice["items"][number]["item_type"]): string {
  switch (itemType) {
    case "cup":
      return "Cup"
    case "lid":
      return "Lid"
    case "non_stock_item":
      return "General item"
    case "custom_charge":
      return "Custom charge"
    case "product_bundle":
      return "Product bundle"
  }
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
        {formatMoneyValue(value)}
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
