import { useEffect, useMemo, useState } from "react"

import { Link, Navigate } from "@tanstack/react-router"

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
import { cn } from "@workspace/ui/lib/utils"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import {
  appPermissions,
  getDefaultAuthorizedRoute,
  hasPermission,
} from "@/features/auth/permissions"
import type {
  Order,
  ProgressEvent,
  ProgressStage,
  ProgressTotals,
} from "@/features/orders/api/orders-client"
import {
  progressStageOptions,
  useCreateProgressEventMutation,
  useOrderQuery,
  useProgressEventsQuery,
} from "@/features/orders/hooks/use-orders"
import { ArrowLeftIcon, BoxIcon } from "lucide-react"

type BundleFulfillmentPart = "cup" | "lid"

type TrackedLineItem = Order["items"][number] & {
  item_type: "cup" | "lid" | "product_bundle"
}

type FulfillmentRow = {
  key: string
  item: TrackedLineItem
  bundlePart: BundleFulfillmentPart | null
}

type ProgressStageRuleSet = "lid" | "default"

function getProgressStageRuleSet(
  itemType: Order["items"][number]["item_type"],
  row: FulfillmentRow | null
): ProgressStageRuleSet {
  if (itemType === "lid") {
    return "lid"
  }
  if (itemType === "product_bundle" && row?.bundlePart === "lid") {
    return "lid"
  }
  return "default"
}

function buildFulfillmentRows(order: Order | null): FulfillmentRow[] {
  if (!order) {
    return []
  }

  const rows: FulfillmentRow[] = []

  for (const raw of order.items) {
    if (
      raw.item_type === "non_stock_item" ||
      raw.item_type === "custom_charge"
    ) {
      continue
    }

    const item = raw as TrackedLineItem

    if (item.item_type === "product_bundle") {
      const b = item.product_bundle
      let hasPart = false
      if (b.cup) {
        rows.push({ key: `${item.id}:cup`, item, bundlePart: "cup" })
        hasPart = true
      }
      if (b.lid) {
        rows.push({ key: `${item.id}:lid`, item, bundlePart: "lid" })
        hasPart = true
      }
      if (!hasPart) {
        rows.push({ key: item.id, item, bundlePart: null })
      }
      continue
    }

    rows.push({ key: item.id, item, bundlePart: null })
  }

  return rows
}

export function OrderFulfillmentPage({ orderId }: { orderId: string }) {
  const currentUser = useCurrentUser()
  const orderQuery = useOrderQuery(orderId)
  const canRecordFulfillment = hasPermission(
    currentUser.data,
    appPermissions.ordersFulfillmentRecord
  )
  const createProgressEventMutation = useCreateProgressEventMutation()
  const [selectedFulfillmentKey, setSelectedFulfillmentKey] = useState<
    string | null
  >(null)
  const [progressStage, setProgressStage] = useState<ProgressStage>("printed")
  const [progressQuantity, setProgressQuantity] = useState("1")
  const [progressNote, setProgressNote] = useState("")
  const [progressEventDate, setProgressEventDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [progressError, setProgressError] = useState<string | null>(null)
  const [progressSuccess, setProgressSuccess] = useState<string | null>(null)

  const order = orderQuery.data ?? null
  const fulfillmentRows = useMemo(() => buildFulfillmentRows(order), [order])
  const activeFulfillmentKey =
    selectedFulfillmentKey ?? fulfillmentRows[0]?.key ?? null
  const selectedRow = activeFulfillmentKey
    ? (fulfillmentRows.find((row) => row.key === activeFulfillmentKey) ?? null)
    : null
  const selectedLineItem = selectedRow?.item ?? null

  useEffect(() => {
    if (fulfillmentRows.length === 0) {
      if (selectedFulfillmentKey !== null) {
        setSelectedFulfillmentKey(null)
      }
      return
    }

    const firstKey = fulfillmentRows[0]?.key
    if (
      firstKey &&
      (selectedFulfillmentKey === null ||
        !fulfillmentRows.some((row) => row.key === selectedFulfillmentKey))
    ) {
      setSelectedFulfillmentKey(firstKey)
    }
  }, [fulfillmentRows, selectedFulfillmentKey])

  const progressEventsQuery = useProgressEventsQuery(
    selectedLineItem?.id ?? null,
    selectedLineItem?.item_type === "product_bundle"
      ? (selectedRow?.bundlePart ?? undefined)
      : undefined
  )
  const availableProgressStages = getAllowedProgressStagesForRow(selectedRow)
  const defaultProgressStage: ProgressStage =
    availableProgressStages[0] ?? "printed"
  const effectiveProgressStage = availableProgressStages.includes(progressStage)
    ? progressStage
    : defaultProgressStage

  useEffect(() => {
    if (!activeFulfillmentKey) {
      return
    }
    const row =
      fulfillmentRows.find((r) => r.key === activeFulfillmentKey) ?? null
    const allowed = getAllowedProgressStagesForRow(row)
    setProgressStage((current) =>
      allowed.includes(current) ? current : (allowed[0] ?? "packed")
    )
  }, [activeFulfillmentKey, fulfillmentRows])

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canRecordFulfillment) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== `/orders/${orderId}/fulfillment`) {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>
          Fulfillment updates require fulfillment-record permission.
        </AlertDescription>
      </Alert>
    )
  }

  async function handleCreateProgressEvent() {
    setProgressError(null)
    setProgressSuccess(null)

    if (!order || !selectedLineItem || !selectedRow) {
      setProgressError("Select an order line item before recording progress.")
      return
    }

    if (order.status === "canceled" || order.status === "completed") {
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
      const stageRules = getProgressStageRuleSet(
        selectedLineItem.item_type,
        selectedRow
      )
      const maxQuantity = maxQuantityForStage(
        selectedLineItem.item_type,
        effectiveProgressStage,
        selectedLineItem.quantity,
        totals,
        stageRules
      )

      if (quantity > maxQuantity) {
        setProgressError(
          buildProgressQuantityError(
            selectedLineItem.item_type,
            effectiveProgressStage,
            maxQuantity,
            selectedRow
          )
        )
        return
      }
    }

    try {
      const result = await createProgressEventMutation.mutateAsync({
        orderLineItemId: selectedLineItem.id,
        payload: {
          stage: effectiveProgressStage,
          component_item_type:
            selectedLineItem.item_type === "product_bundle"
              ? (selectedRow.bundlePart ?? undefined)
              : undefined,
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

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle>Fulfillment Progress</CardTitle>
            <CardDescription>
              Record quantity-based line-item progress.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/orders">
                <ArrowLeftIcon className="size-4" />
                Orders
              </Link>
            </Button>
            {order ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/orders/$orderId" params={{ orderId: order.id }}>
                  <BoxIcon className="size-4" /> Details
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {orderQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading order...</p>
        ) : null}

        {orderQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{orderQuery.error.message}</AlertDescription>
          </Alert>
        ) : null}

        {order ? (
          <>
            <div className="grid gap-3 border p-4 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="grid gap-1">
                <p className="font-medium">{order.order_number}</p>
                <p className="text-muted-foreground">
                  {order.customer.business_name} · {formatStatus(order.status)}
                </p>
                <p className="text-muted-foreground">
                  {fulfillmentRows.length.toLocaleString()} fulfillable line(s)
                </p>
              </div>
              <Badge variant="secondary">
                Total qty {totalQuantity(order).toLocaleString()}
              </Badge>
            </div>

            {fulfillmentRows.length === 0 ? (
              <Alert>
                <AlertDescription>
                  This order only contains non-inventory lines. There is no
                  fulfillment progress workflow because general items and custom
                  charges do not reserve or consume inventory.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="">
                <div className="mb-4 grid gap-2 bg-orange-300 p-3">
                  <Label>Select Order Item</Label>
                  <Select
                    value={activeFulfillmentKey ?? undefined}
                    onValueChange={(rowKey) => {
                      setSelectedFulfillmentKey(rowKey)
                      setProgressError(null)
                      setProgressSuccess(null)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select line item" />
                    </SelectTrigger>
                    <SelectContent>
                      {fulfillmentRows.map((row) => (
                        <SelectItem key={row.key} value={row.key}>
                          {formatFulfillmentRowLabel(row)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="grid gap-3">
                    {selectedLineItem && selectedRow ? (
                      <div className="grid gap-2 border p-3 text-sm">
                        <div>
                          <p className="font-medium">
                            {formatBundleAwareTitle(
                              selectedLineItem,
                              selectedRow.bundlePart
                            )}
                          </p>
                          <p className="text-muted-foreground">
                            {formatOrderItemDetails(selectedLineItem)}
                          </p>
                          {selectedLineItem.item_type === "product_bundle" &&
                          selectedRow.bundlePart ? (
                            <p className="text-xs text-muted-foreground">
                              {formatBundleComponentInventoryHint(
                                selectedLineItem,
                                selectedRow.bundlePart
                              )}
                            </p>
                          ) : null}
                          {selectedLineItem.item_type === "product_bundle" &&
                          selectedRow.bundlePart ? (
                            <p className="text-xs text-muted-foreground">
                              {selectedRow.bundlePart === "lid" ? (
                                <>
                                  Lids follow the same{" "}
                                  <span className="font-medium">
                                    packed → ready → released
                                  </span>{" "}
                                  rules as a stand-alone lid (no printed/QA on
                                  the lid). Quantities are in{" "}
                                  <span className="font-medium">
                                    bundle sets
                                  </span>
                                  . Use the{" "}
                                  <span className="font-medium">cup</span> row
                                  for printed/QA when working on cups.
                                </>
                              ) : (
                                <>
                                  Cups follow the same printed → QA → packed →
                                  ready → released flow as a stand-alone cup.
                                  Quantities are in{" "}
                                  <span className="font-medium">
                                    bundle sets
                                  </span>
                                  .
                                </>
                              )}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant="secondary" className="w-fit">
                          {formatOrderedQuantityLine(
                            selectedLineItem,
                            selectedRow.bundlePart
                          )}
                        </Badge>
                      </div>
                    ) : null}

                    <div className="grid gap-3 border p-3">
                      <div className="grid gap-2">
                        <Label>Stage</Label>
                        <Select
                          value={effectiveProgressStage}
                          onValueChange={(value) =>
                            setProgressStage(value as ProgressStage)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProgressStages.map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {formatStatus(stage)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedLineItem && progressEventsQuery.data ? (
                          <p className="text-xs text-muted-foreground">
                            {describeStageBalance(
                              selectedLineItem.item_type,
                              effectiveProgressStage,
                              selectedLineItem.quantity,
                              progressEventsQuery.data.totals,
                              selectedRow
                            )}
                          </p>
                        ) : null}
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
                        disabled={
                          createProgressEventMutation.isPending ||
                          order.status === "canceled" ||
                          order.status === "completed" ||
                          !selectedLineItem
                        }
                        onClick={handleCreateProgressEvent}
                      >
                        {createProgressEventMutation.isPending
                          ? "Recording progress..."
                          : "Record progress"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid content-start gap-4 self-start">
                    {progressEventsQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">
                        Loading progress totals...
                      </p>
                    ) : null}

                    {progressEventsQuery.isError ? (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {progressEventsQuery.error.message}
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {selectedLineItem && progressEventsQuery.data ? (
                      <>
                        <ProgressTotalsGrid
                          showPrintedQa={showPrintedQaColumns(
                            selectedLineItem.item_type,
                            selectedRow
                          )}
                          totals={progressEventsQuery.data.totals}
                        />
                        <ProgressHistory
                          events={progressEventsQuery.data.events}
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function totalQuantity(order: Order): number {
  return order.items.reduce((total, item) => total + item.quantity, 0)
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ")
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

  if (item.item_type === "product_bundle") {
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

  if (item.item_type === "product_bundle") {
    return item.product_bundle.description?.trim() || "Product bundle"
  }

  return item.non_stock_item.description?.trim() || item.description_snapshot
}

function formatFulfillmentRowLabel(row: FulfillmentRow): string {
  const item = row.item
  const qty = item.quantity.toLocaleString()
  if (item.item_type !== "product_bundle" || !row.bundlePart) {
    return `${formatOrderItemLabel(item)} × ${qty}`
  }

  const b = item.product_bundle
  if (row.bundlePart === "cup" && b.cup) {
    return `${b.name} — cup ${b.cup.sku} × ${qty} set(s)`
  }
  if (row.bundlePart === "lid" && b.lid) {
    return `${b.name} — lid ${b.lid.sku} × ${qty} set(s)`
  }

  return `${formatOrderItemLabel(item)} × ${qty}`
}

function formatBundleAwareTitle(
  item: TrackedLineItem,
  bundlePart: BundleFulfillmentPart | null
): string {
  if (item.item_type !== "product_bundle" || !bundlePart) {
    return formatOrderItemLabel(item)
  }

  const b = item.product_bundle
  if (bundlePart === "cup" && b.cup) {
    return `${b.name} — cup (${b.cup.sku})`
  }
  if (bundlePart === "lid" && b.lid) {
    return `${b.name} — lid (${b.lid.sku})`
  }

  return formatOrderItemLabel(item)
}

function formatBundleComponentInventoryHint(
  item: Extract<TrackedLineItem, { item_type: "product_bundle" }>,
  bundlePart: BundleFulfillmentPart
): string {
  const b = item.product_bundle
  const sets = item.quantity
  if (bundlePart === "cup" && b.cup) {
    const units = sets * b.cup_qty_per_set
    return `Cup pieces for this order: ${units.toLocaleString()} (${sets.toLocaleString()} set(s) × ${b.cup_qty_per_set} per set). Cup reservation is drawn when you record Printed.`
  }
  if (bundlePart === "lid" && b.lid) {
    const units = sets * b.lid_qty_per_set
    return `Lid pieces for this order: ${units.toLocaleString()} (${sets.toLocaleString()} set(s) × ${b.lid_qty_per_set} per set). Lid reservation is drawn when you record Released.`
  }
  return ""
}

function formatOrderedQuantityLine(
  item: TrackedLineItem,
  bundlePart: BundleFulfillmentPart | null
): string {
  if (item.item_type !== "product_bundle" || !bundlePart) {
    return `Ordered ${item.quantity.toLocaleString()}`
  }

  const b = item.product_bundle
  const sets = item.quantity
  if (bundlePart === "cup" && b.cup) {
    return `Ordered ${sets.toLocaleString()} set(s) · ${(sets * b.cup_qty_per_set).toLocaleString()} cup pieces`
  }
  if (bundlePart === "lid" && b.lid) {
    return `Ordered ${sets.toLocaleString()} set(s) · ${(sets * b.lid_qty_per_set).toLocaleString()} lid pieces`
  }

  return `Ordered ${sets.toLocaleString()}`
}

function getAllowedProgressStagesForRow(
  row: FulfillmentRow | null
): ProgressStage[] {
  if (!row) {
    return []
  }
  if (row.item.item_type === "lid") {
    return ["packed", "ready_for_release", "released"]
  }
  if (row.item.item_type === "product_bundle" && row.bundlePart === "lid") {
    return ["packed", "ready_for_release", "released"]
  }
  return [...progressStageOptions]
}

function showPrintedQaColumns(
  itemType: Order["items"][number]["item_type"],
  row: FulfillmentRow | null
): boolean {
  if (itemType === "cup") {
    return true
  }
  if (itemType === "product_bundle") {
    return row?.bundlePart !== "lid"
  }
  return false
}

function ProgressTotalsGrid({
  showPrintedQa,
  totals,
}: {
  showPrintedQa: boolean
  totals: ProgressTotals
}) {
  return (
    <div
      className={cn(
        "grid gap-1 self-start text-xs",
        showPrintedQa ? "sm:grid-cols-7" : "sm:grid-cols-5"
      )}
    >
      <div className="flex h-14 flex-col justify-between border bg-muted/30 p-2">
        <p className="text-muted-foreground">Status</p>
        <p className="text-base font-semibold">
          {formatStatus(totals.line_item_status)}
        </p>
      </div>
      {showPrintedQa ? (
        <ProgressTotal label="Printed" value={totals.total_printed} />
      ) : null}
      {showPrintedQa ? (
        <ProgressTotal label="QA passed" value={totals.total_qa_passed} />
      ) : null}
      <ProgressTotal label="Packed" value={totals.total_packed} />
      <ProgressTotal label="Ready" value={totals.total_ready_for_release} />
      <ProgressTotal
        className="bg-primary/10"
        label="Released"
        value={totals.total_released}
      />
      <ProgressTotal
        className="bg-destructive/10"
        label="Remaining"
        value={totals.remaining_balance}
      />
    </div>
  )
}

function ProgressTotal({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-14 flex-col justify-between border bg-muted/30 p-2",
        className
      )}
    >
      <p className="text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value.toLocaleString()}</p>
    </div>
  )
}

function ProgressHistory({ events }: { events: ProgressEvent[] }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Progress history</h2>
        <Badge variant="secondary">{events.length} events</Badge>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No progress events recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Recorded by</TableHead>
                <TableHead>Created</TableHead>
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
  totals: ProgressTotals,
  stageRules: ProgressStageRuleSet
): number {
  if (itemType === "non_stock_item" || itemType === "custom_charge") {
    return 0
  }

  if (stageRules === "lid") {
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

function describeStageBalance(
  itemType: Order["items"][number]["item_type"],
  stage: ProgressStage,
  orderedQuantity: number,
  totals: ProgressTotals,
  row: FulfillmentRow | null
): string {
  const stageRules = getProgressStageRuleSet(itemType, row)
  if (stageRules === "lid") {
    const maxQuantity = maxQuantityForStage(
      itemType,
      stage,
      orderedQuantity,
      totals,
      "lid"
    )
    switch (stage) {
      case "packed":
        return `Up to ${maxQuantity.toLocaleString()} more can be packed for this line.`
      case "ready_for_release":
        return `Up to ${maxQuantity.toLocaleString()} more can move to ready for release.`
      case "released":
        return `Up to ${maxQuantity.toLocaleString()} more can be released.`
      default:
        return ""
    }
  }

  const maxQuantity = maxQuantityForStage(
    itemType,
    stage,
    orderedQuantity,
    totals,
    "default"
  )

  switch (stage) {
    case "printed":
      return "Printed supports overrun. Record the actual printed quantity."
    case "qa_passed":
      return `Available from printed: ${maxQuantity.toLocaleString()}.`
    case "packed":
      return `Available from QA passed: ${maxQuantity.toLocaleString()}.`
    case "ready_for_release":
      return `Available from packed: ${maxQuantity.toLocaleString()}.`
    case "released":
      return `Available from ready for release: ${maxQuantity.toLocaleString()}.`
  }
}

function buildProgressQuantityError(
  itemType: Order["items"][number]["item_type"],
  stage: ProgressStage,
  maxQuantity: number,
  row: FulfillmentRow | null
): string {
  const rules = getProgressStageRuleSet(itemType, row)
  if (rules === "lid") {
    switch (stage) {
      case "packed":
        return `Packed quantity cannot exceed ${maxQuantity} (remaining to pack on this line).`
      case "ready_for_release":
        return `Ready for release quantity cannot exceed the current moveable packed balance of ${maxQuantity}.`
      case "released":
        return `Released quantity cannot exceed the current ready-for-release balance of ${maxQuantity}.`
      default:
        return `This stage is not used for lid line items.`
    }
  }

  switch (stage) {
    case "ready_for_release":
      return `Ready for release quantity cannot exceed the current packed balance of ${maxQuantity}.`
    case "released":
      return `Released quantity cannot exceed the current ready-for-release balance of ${maxQuantity}. Record ready for release first if more packed quantity is waiting.`
    case "qa_passed":
      return `QA passed quantity cannot exceed the current printed balance of ${maxQuantity}.`
    case "packed":
      return `Packed quantity cannot exceed the current QA-passed balance of ${maxQuantity}.`
    case "printed":
      return itemType === "cup" || itemType === "product_bundle"
        ? "Printed supports overrun and should not be capped here."
        : `Printed is not supported for ${itemType} line items.`
  }
}
