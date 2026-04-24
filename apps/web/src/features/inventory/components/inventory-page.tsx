import { useMemo, useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Link, Navigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
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

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { appPermissions, getDefaultAuthorizedRoute, hasPermission } from "@/features/auth/permissions"
import type { InventoryBalance } from "@/features/inventory/api/inventory-client"
import {
  useInventoryAdjustmentMutation,
  useInventoryBalancesQuery,
  useStockIntakeMutation,
} from "@/features/inventory/hooks/use-inventory"
import { EyeIcon, PackageSearchIcon, PlusIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"

const stockIntakeFormSchema = z.object({
  quantity: z.number().int().positive("Quantity must be a positive whole number."),
  reference: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
})

const adjustmentFormSchema = z.object({
  movementType: z.enum(["adjustment_in", "adjustment_out"]),
  quantity: z.number().int().positive("Quantity must be a positive whole number."),
  reference: z.string().trim().max(160).optional(),
  note: z.string().trim().min(1, "Reason is required.").max(500),
})

type StockIntakeFormValues = z.infer<typeof stockIntakeFormSchema>
type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>

const emptyFormValues: StockIntakeFormValues = {
  quantity: 0,
  reference: "",
  note: "",
}

const emptyAdjustmentValues: AdjustmentFormValues = {
  movementType: "adjustment_in",
  quantity: 0,
  reference: "",
  note: "",
}

export function InventoryPage() {
  const currentUser = useCurrentUser()
  const balancesQuery = useInventoryBalancesQuery()
  const stockIntake = useStockIntakeMutation()
  const inventoryAdjustment = useInventoryAdjustmentMutation()
  const [search, setSearch] = useState("")
  const [brandFilter, setBrandFilter] = useState("all")
  const [sizeFilter, setSizeFilter] = useState("all")
  const [colorFilter, setColorFilter] = useState("all")
  const [activeBalanceKey, setActiveBalanceKey] = useState<string | null>(null)
  const [isReceiveStockDialogOpen, setIsReceiveStockDialogOpen] = useState(false)
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const canViewInventory = hasPermission(currentUser.data, appPermissions.inventoryView)
  const canRecordStockIntake = hasPermission(currentUser.data, appPermissions.inventoryStockIntake)
  const canAdjustInventory = hasPermission(currentUser.data, appPermissions.inventoryAdjust)
  const canCreateCups = hasPermission(currentUser.data, appPermissions.cupsManage)
  const canCreateLids = hasPermission(currentUser.data, appPermissions.lidsManage)

  const form = useForm<StockIntakeFormValues>({
    resolver: zodResolver(stockIntakeFormSchema),
    defaultValues: emptyFormValues,
  })
  const adjustmentForm = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: emptyAdjustmentValues,
  })

  const filteredBalances = useMemo(
    () => filterBalances(balancesQuery.data, { search, brandFilter, sizeFilter, colorFilter }),
    [balancesQuery.data, brandFilter, colorFilter, search, sizeFilter],
  )
  const brandOptions = useMemo(() => getInventoryFilterOptions(balancesQuery.data, "brand"), [balancesQuery.data])
  const sizeOptions = useMemo(() => getInventoryFilterOptions(balancesQuery.data, "size"), [balancesQuery.data])
  const colorOptions = useMemo(() => getInventoryFilterOptions(balancesQuery.data, "color"), [balancesQuery.data])

  const selectedBalance = useMemo(
    () =>
      balancesQuery.data?.find((balance) => toInventoryItemKey(balance) === activeBalanceKey) ?? null,
    [activeBalanceKey, balancesQuery.data],
  )

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canViewInventory) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/inventory") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Inventory visibility requires inventory-view permission.</AlertDescription>
      </Alert>
    )
  }

  async function onSubmit(values: StockIntakeFormValues) {
    if (!selectedBalance) {
      setSubmitError("Select a tracked item before recording stock intake.")
      return
    }

    if (!isInventoryItemActive(selectedBalance)) {
      setSubmitError("Inactive items cannot receive stock intake.")
      return
    }

    setSubmitError(null)
    setPageNotice(null)

    try {
      await stockIntake.mutateAsync(
        selectedBalance.item_type === "cup"
          ? {
              itemType: "cup",
              cupId: selectedBalance.cup.id,
              quantity: values.quantity,
              note: values.note?.trim() || undefined,
              reference: values.reference?.trim() || undefined,
            }
          : {
              itemType: "lid",
              lidId: selectedBalance.lid.id,
              quantity: values.quantity,
              note: values.note?.trim() || undefined,
              reference: values.reference?.trim() || undefined,
            },
      )

      form.reset(emptyFormValues)
      setIsReceiveStockDialogOpen(false)
      setPageNotice(
        `Recorded ${values.quantity} units as stock_in for ${formatInventoryItemLabel(selectedBalance)}.`,
      )
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to record stock intake.")
    }
  }

  async function onSubmitAdjustment(values: AdjustmentFormValues) {
    if (!selectedBalance) {
      setSubmitError("Select a tracked item before recording an adjustment.")
      return
    }

    if (!isInventoryItemActive(selectedBalance)) {
      setSubmitError("Inactive items cannot be adjusted.")
      return
    }

    setSubmitError(null)
    setPageNotice(null)

    try {
      await inventoryAdjustment.mutateAsync(
        selectedBalance.item_type === "cup"
          ? {
              itemType: "cup",
              cupId: selectedBalance.cup.id,
              movementType: values.movementType,
              quantity: values.quantity,
              note: values.note.trim(),
              reference: values.reference?.trim() || undefined,
            }
          : {
              itemType: "lid",
              lidId: selectedBalance.lid.id,
              movementType: values.movementType,
              quantity: values.quantity,
              note: values.note.trim(),
              reference: values.reference?.trim() || undefined,
            },
      )

      adjustmentForm.reset(emptyAdjustmentValues)
      setIsAdjustmentDialogOpen(false)
      setPageNotice(
        `Recorded ${values.quantity} units as ${values.movementType} for ${formatInventoryItemLabel(selectedBalance)}.`,
      )
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to record inventory adjustment.",
      )
    }
  }

  function openReceiveStockDialog(balance: InventoryBalance) {
    setActiveBalanceKey(toInventoryItemKey(balance))
    setSubmitError(null)
    setPageNotice(null)
    form.reset(emptyFormValues)
    setIsReceiveStockDialogOpen(true)
  }

  function openAdjustmentDialog(balance: InventoryBalance) {
    setActiveBalanceKey(toInventoryItemKey(balance))
    setSubmitError(null)
    setPageNotice(null)
    adjustmentForm.reset(emptyAdjustmentValues)
    setIsAdjustmentDialogOpen(true)
  }

  function handleReceiveStockDialogOpenChange(open: boolean) {
    setIsReceiveStockDialogOpen(open)

    if (!open) {
      setSubmitError(null)
      form.reset(emptyFormValues)
    }
  }

  function handleAdjustmentDialogOpenChange(open: boolean) {
    setIsAdjustmentDialogOpen(open)

    if (!open) {
      setSubmitError(null)
      adjustmentForm.reset(emptyAdjustmentValues)
    }
  }

  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-1">
              <CardTitle>Inventory Balances</CardTitle>
              <CardDescription>
                Cups and lids now share the same movement-ledger model. Stock intake writes a real <code>stock_in</code> movement.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild type="button" size="sm" variant="outline">
                <Link to="/inventory-history">
                  <EyeIcon className="size-4" /> History
                </Link>
              </Button>
              {canCreateCups || canCreateLids ? (
                <>
                  {canCreateCups ? (
                    <Button asChild type="button" size="sm" variant="outline">
                      <Link to="/cups">
                        <PlusIcon className="size-4" /> Cup
                      </Link>
                    </Button>
                  ) : null}
                  {canCreateLids ? (
                    <Button asChild type="button"  size="sm" variant="outline">
                      <Link to="/lids">
                        <PlusIcon className="size-4" /> Lid
                      </Link>
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          {currentUser.data && !canRecordStockIntake && !canAdjustInventory ? (
            <Alert>
              <AlertDescription>
                Your account can inspect stock balances, but stock changes require inventory permissions.
              </AlertDescription>
            </Alert>
          ) : null}

          {balancesQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{balancesQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {pageNotice ? (
            <Alert>
              <AlertDescription>{pageNotice}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="inventory-search">Find tracked items</Label>
            <Input
              id="inventory-search"
              placeholder="Search cups or lids"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <CatalogFilterSelect
              label="Brand"
              value={brandFilter}
              options={brandOptions}
              onValueChange={setBrandFilter}
            />
            <CatalogFilterSelect
              label="Size"
              value={sizeFilter}
              options={sizeOptions}
              onValueChange={setSizeFilter}
            />
            <CatalogFilterSelect
              label="Color"
              value={colorFilter}
              options={colorOptions}
              onValueChange={setColorFilter}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {balancesQuery.isLoading ? <InventoryTableSkeleton /> : null}

          {!balancesQuery.isLoading && filteredBalances.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageSearchIcon />
                </EmptyMedia>
                <EmptyTitle>No balances to show</EmptyTitle>
                <EmptyDescription>No tracked items match the current search.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {!balancesQuery.isLoading && filteredBalances.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item type</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>On hand</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Min stock</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBalances.map((balance) => (
                <TableRow key={toInventoryItemKey(balance)}>
                  <TableCell>
                    <Badge variant="outline">{balance.item_type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{formatInventoryItemPrimaryLabel(balance)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatInventoryItemSecondaryLabel(balance)}
                  </TableCell>
                  <TableCell>{balance.on_hand}</TableCell>
                  <TableCell>{balance.reserved}</TableCell>
                  <TableCell
                    className={balance.available < 0 ? "font-semibold text-destructive" : undefined}
                  >
                    {balance.available}
                  </TableCell>
                  <TableCell>
                    {balance.item_type === "cup" ? balance.cup.min_stock : balance.lid.min_stock}
                  </TableCell>
                  <TableCell>
                    <Badge variant={stockStateVariant(balance)}>{stockStateLabel(balance)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isInventoryItemActive(balance) ? "default" : "secondary"}>
                      {isInventoryItemActive(balance) ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog
                        open={
                          isReceiveStockDialogOpen &&
                          toInventoryItemKey(balance) === activeBalanceKey
                        }
                        onOpenChange={handleReceiveStockDialogOpenChange}
                      >
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!canRecordStockIntake || !isInventoryItemActive(balance)}
                            onClick={() => openReceiveStockDialog(balance)}
                          >
                            Receive
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Receive Stock</DialogTitle>
                            <DialogDescription>
                              Record a new <code>stock_in</code> movement for the selected tracked
                              item.
                            </DialogDescription>
                          </DialogHeader>

                          {submitError ? (
                            <Alert variant="destructive">
                              <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                          ) : null}

                          {selectedBalance ? (
                            <InventoryItemSummary balance={selectedBalance} />
                          ) : null}

                          <Form {...form}>
                            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
                              <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Quantity</FormLabel>
                                    <FormControl>
                                      <Input.Number
                                        disabled={!canRecordStockIntake}
                                        min={0}
                                        value={field.value}
                                        onChange={(value) => field.onChange(value ?? 0)}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="reference"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Reference</FormLabel>
                                    <FormControl>
                                      <Input
                                        disabled={!canRecordStockIntake}
                                        {...field}
                                        value={field.value ?? ""}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="note"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Note</FormLabel>
                                    <FormControl>
                                      <Input
                                        disabled={!canRecordStockIntake}
                                        {...field}
                                        value={field.value ?? ""}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <Button type="submit" disabled={!canRecordStockIntake || stockIntake.isPending}>
                                {stockIntake.isPending ? "Recording..." : "Record stock intake"}
                              </Button>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>

                      <Dialog
                        open={
                          isAdjustmentDialogOpen &&
                          toInventoryItemKey(balance) === activeBalanceKey
                        }
                        onOpenChange={handleAdjustmentDialogOpenChange}
                      >
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!canAdjustInventory || !isInventoryItemActive(balance)}
                            onClick={() => openAdjustmentDialog(balance)}
                          >
                            Adjust
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Manual Adjustment</DialogTitle>
                            <DialogDescription>
                              Record a real <code>adjustment_in</code> or{" "}
                              <code>adjustment_out</code> movement for the selected tracked item.
                            </DialogDescription>
                          </DialogHeader>

                          {submitError ? (
                            <Alert variant="destructive">
                              <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                          ) : null}

                          {selectedBalance ? (
                            <InventoryItemSummary balance={selectedBalance} />
                          ) : null}

                          <Form {...adjustmentForm}>
                            <form
                              className="grid gap-4"
                              onSubmit={adjustmentForm.handleSubmit(onSubmitAdjustment)}
                            >
                              <FormField
                                control={adjustmentForm.control}
                                name="movementType"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Adjustment type</FormLabel>
                                    <Select
                                      disabled={!canAdjustInventory}
                                      value={field.value}
                                      onValueChange={field.onChange}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="w-full border px-3">
                                          <SelectValue placeholder="Select adjustment type" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="adjustment_in">Adjustment in</SelectItem>
                                        <SelectItem value="adjustment_out">
                                          Adjustment out
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={adjustmentForm.control}
                                name="quantity"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Quantity</FormLabel>
                                    <FormControl>
                                      <Input.Number
                                        disabled={!canAdjustInventory}
                                        min={0}
                                        value={field.value}
                                        onChange={(value) => field.onChange(value ?? 0)}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={adjustmentForm.control}
                                name="reference"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Reference</FormLabel>
                                    <FormControl>
                                      <Input
                                        disabled={!canAdjustInventory}
                                        {...field}
                                        value={field.value ?? ""}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={adjustmentForm.control}
                                name="note"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Reason</FormLabel>
                                    <FormControl>
                                      <Input
                                        disabled={!canAdjustInventory}
                                        {...field}
                                        value={field.value ?? ""}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <Button
                                type="submit"
                                disabled={!canAdjustInventory || inventoryAdjustment.isPending}
                              >
                                {inventoryAdjustment.isPending
                                  ? "Recording..."
                                  : "Record adjustment"}
                              </Button>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

const INV_SKEL_HEADER_KEYS = ["h0", "h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8", "h9"] as const
const INV_SKEL_ROW_KEYS = ["r0", "r1", "r2", "r3", "r4", "r5"] as const
const INV_SKEL_CELL_KEYS = ["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"] as const

function InventoryTableSkeleton() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-10 gap-2">
        {INV_SKEL_HEADER_KEYS.map((id) => (
          <Skeleton key={id} className="h-4 w-full" />
        ))}
      </div>
      {INV_SKEL_ROW_KEYS.map((rowId) => (
        <div key={rowId} className="grid grid-cols-10 gap-2">
          {INV_SKEL_CELL_KEYS.map((cellId) => (
            <Skeleton key={`${rowId}-${cellId}`} className="h-9 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

function InventoryItemSummary({ balance }: { balance: InventoryBalance }) {
  return (
    <div className="grid gap-3 border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="grid gap-1">
          <p className="text-sm font-medium">{formatInventoryItemLabel(balance)}</p>
          <p className="text-sm text-muted-foreground">
            {formatInventoryItemSecondaryLabel(balance)}
          </p>
        </div>
        <Badge variant={isInventoryItemActive(balance) ? "default" : "secondary"}>
          {isInventoryItemActive(balance) ? "Active" : "Inactive"}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
        <span>On hand: {balance.on_hand}</span>
        <span>Reserved: {balance.reserved}</span>
        <span>Available: {balance.available}</span>
      </div>
    </div>
  )
}

function CatalogFilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: string[]
  onValueChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function filterBalances(
  balances: InventoryBalance[] | undefined,
  filters: {
    search: string
    brandFilter: string
    sizeFilter: string
    colorFilter: string
  },
): InventoryBalance[] {
  if (!balances) {
    return []
  }

  const normalizedSearch = filters.search.trim().toLowerCase()

  return balances.filter((balance) => {
    if (filters.brandFilter !== "all" && getInventoryFilterValue(balance, "brand") !== filters.brandFilter) {
      return false
    }

    if (filters.sizeFilter !== "all" && getInventoryFilterValue(balance, "size") !== filters.sizeFilter) {
      return false
    }

    if (filters.colorFilter !== "all" && getInventoryFilterValue(balance, "color") !== filters.colorFilter) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    return [balance.item_type, formatInventoryItemLabel(balance), formatInventoryItemSecondaryLabel(balance)]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch)
  })
}

function getInventoryFilterOptions(
  balances: InventoryBalance[] | undefined,
  field: "brand" | "size" | "color",
): string[] {
  if (!balances) {
    return []
  }

  return [...new Set(balances.map((balance) => getInventoryFilterValue(balance, field)).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true }),
  )
}

function getInventoryFilterValue(
  balance: InventoryBalance,
  field: "brand" | "size" | "color",
): string {
  if (balance.item_type === "cup") {
    if (field === "brand") {
      return balance.cup.brand
    }

    if (field === "size") {
      return balance.cup.size
    }

    return balance.cup.color
  }

  if (field === "brand") {
    return balance.lid.brand
  }

  if (field === "size") {
    return balance.lid.diameter
  }

  return balance.lid.color
}

function formatInventoryItemLabel(balance: InventoryBalance): string {
  if (balance.item_type === "cup") {
    return balance.cup.sku
  }

  return balance.lid.sku
}

function formatInventoryItemPrimaryLabel(balance: InventoryBalance): string {
  if (balance.item_type === "cup") {
    return balance.cup.sku
  }

  return balance.lid.sku
}

function formatInventoryItemSecondaryLabel(balance: InventoryBalance): string {
  if (balance.item_type === "cup") {
    return `${balance.cup.type} · ${balance.cup.brand} · ${balance.cup.size} · ${balance.cup.diameter} · ${balance.cup.color}`
  }

  return `${balance.lid.type} · ${balance.lid.brand} · ${balance.lid.color}`
}

function isInventoryItemActive(balance: InventoryBalance): boolean {
  return balance.item_type === "cup" ? balance.cup.is_active : balance.lid.is_active
}

function stockStateLabel(balance: InventoryBalance): string {
  if (balance.available < 0) {
    return "Negative"
  }

  if (balance.item_type === "cup" && balance.available <= balance.cup.min_stock) {
    return "Low"
  }

  if (balance.item_type === "lid" && balance.available <= balance.lid.min_stock) {
    return "Low"
  }

  return "Healthy"
}

function stockStateVariant(balance: InventoryBalance): "default" | "secondary" | "destructive" {
  if (balance.available < 0) {
    return "destructive"
  }

  if (balance.item_type === "cup" && balance.available <= balance.cup.min_stock) {
    return "secondary"
  }

  if (balance.item_type === "lid" && balance.available <= balance.lid.min_stock) {
    return "secondary"
  }

  return "default"
}

function toInventoryItemKey(balance: InventoryBalance): string {
  return balance.item_type === "cup" ? `cup:${balance.cup.id}` : `lid:${balance.lid.id}`
}
