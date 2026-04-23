import { useMemo, useState } from "react"

import { Link } from "@tanstack/react-router"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
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
import type { CupPayload } from "@/features/cups/api/cups-client"
import {
  useCreateCupMutation,
  useCupsQuery,
} from "@/features/cups/hooks/use-cups"
import { normalizeSku, skuSchema } from "@/features/cups/types/sku"
import type { InventoryBalance } from "@/features/inventory/api/inventory-client"
import {
  useInventoryBalancesQuery,
  useStockIntakeMutation,
} from "@/features/inventory/hooks/use-inventory"

const emptyCupForm: CupPayload = {
  sku: "",
  brand: "",
  size: "",
  dimension: "",
  material: "",
  color: "",
  min_stock: 0,
  cost_price: "0",
  default_sell_price: "0",
  is_active: true,
}

const emptyIntakeForm = {
  quantity: "0",
  note: "",
  reference: "",
}

export function InventoryPage() {
  const currentUser = useCurrentUser()
  const cupsQuery = useCupsQuery()
  const balancesQuery = useInventoryBalancesQuery()
  const createCup = useCreateCupMutation()
  const stockIntake = useStockIntakeMutation()
  const [search, setSearch] = useState("")
  const [selectedCupId, setSelectedCupId] = useState<string | null>(null)
  const [intakeForm, setIntakeForm] = useState(emptyIntakeForm)
  const [intakeError, setIntakeError] = useState<string | null>(null)
  const [intakeSuccess, setIntakeSuccess] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CupPayload>(emptyCupForm)
  const [createError, setCreateError] = useState<string | null>(null)

  const isAdmin = currentUser.data?.role === "admin"
  const filteredBalances = useMemo(
    () => filterBalances(balancesQuery.data, search),
    [balancesQuery.data, search],
  )
  const selectedCup = useMemo(
    () =>
      balancesQuery.data?.find((balance) => balance.cup.id === selectedCupId)?.cup ??
      cupsQuery.data?.find((cup) => cup.id === selectedCupId) ??
      null,
    [balancesQuery.data, cupsQuery.data, selectedCupId],
  )

  const submitIntake = () => {
    if (!selectedCup) {
      setIntakeError("Select a cup before recording stock intake.")
      setIntakeSuccess(null)
      return
    }

    if (!selectedCup.is_active) {
      setIntakeError("Inactive cups cannot receive stock intake.")
      setIntakeSuccess(null)
      return
    }

    const quantity = Number(intakeForm.quantity)

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setIntakeError("Quantity must be a positive whole number.")
      setIntakeSuccess(null)
      return
    }

    setIntakeError(null)
    setIntakeSuccess(null)

    stockIntake.mutate(
      {
        cupId: selectedCup.id,
        quantity,
        note: intakeForm.note.trim() || undefined,
        reference: intakeForm.reference.trim() || undefined,
      },
      {
        onError: (error) => setIntakeError(error.message),
        onSuccess: (movement) => {
          setIntakeForm(emptyIntakeForm)
          setIntakeSuccess(
            `Recorded ${movement.quantity} units as stock_in for ${selectedCup.sku}.`,
          )
        },
      },
    )
  }

  const submitCreateCup = () => {
    const validation = validateCupForm(createForm)

    setCreateError(validation)

    if (validation) {
      return
    }

    const payload = {
      ...createForm,
      sku: normalizeSku(createForm.sku),
      material: createForm.material || undefined,
      color: createForm.color || undefined,
    }

    createCup.mutate(payload, {
      onError: (error) => setCreateError(error.message),
      onSuccess: (cup) => {
        setSelectedCupId(cup.id)
        setCreateForm(emptyCupForm)
        setCreateError(null)
        setCreateDialogOpen(false)
        setIntakeError(null)
        setIntakeSuccess(`Created ${cup.sku}. You can record stock intake now.`)
      },
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="rounded-none">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-1">
              <CardTitle>Stock Intake</CardTitle>
              <CardDescription>
                Receive stock against an existing SKU and write a real <code>stock_in</code> movement.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild type="button" variant="outline">
                <Link to="/inventory-history">View movement history</Link>
              </Button>
              {isAdmin ? (
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline">
                      Create cup first
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-none sm:max-w-[520px]">
                    <DialogHeader>
                      <DialogTitle>Create Cup</DialogTitle>
                      <DialogDescription>
                        Use this only when the SKU does not exist yet, then continue the intake flow.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                      {createError ? (
                        <Alert variant="destructive">
                          <AlertDescription>{createError}</AlertDescription>
                        </Alert>
                      ) : null}

                      <CupField label="SKU" value={createForm.sku} onChange={(value) => setCreateForm({ ...createForm, sku: value })} />
                      <CupField label="Brand" value={createForm.brand} onChange={(value) => setCreateForm({ ...createForm, brand: value })} />
                      <CupField label="Size" value={createForm.size} onChange={(value) => setCreateForm({ ...createForm, size: value })} />
                      <CupField label="Dimension" value={createForm.dimension} onChange={(value) => setCreateForm({ ...createForm, dimension: value })} />
                      <CupField label="Material" value={createForm.material ?? ""} onChange={(value) => setCreateForm({ ...createForm, material: value })} />
                      <CupField label="Color" value={createForm.color ?? ""} onChange={(value) => setCreateForm({ ...createForm, color: value })} />
                      <CupField label="Min stock" type="number" value={String(createForm.min_stock)} onChange={(value) => setCreateForm({ ...createForm, min_stock: Number(value) })} />
                      <CupField label="Cost price" value={createForm.cost_price} onChange={(value) => setCreateForm({ ...createForm, cost_price: value })} />
                      <CupField label="Default sell price" value={createForm.default_sell_price} onChange={(value) => setCreateForm({ ...createForm, default_sell_price: value })} />

                      <div className="flex gap-2">
                        <Button type="button" onClick={submitCreateCup} disabled={createCup.isPending}>
                          {createCup.isPending ? "Creating..." : "Create cup"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setCreateDialogOpen(false)
                            setCreateForm(emptyCupForm)
                            setCreateError(null)
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : null}
            </div>
          </div>

          {currentUser.data && !isAdmin ? (
            <Alert>
              <AlertDescription>
                Your account can inspect cups, but stock intake is currently restricted to admins.
              </AlertDescription>
            </Alert>
          ) : null}

            {cupsQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>{cupsQuery.error.message}</AlertDescription>
              </Alert>
            ) : null}

          {balancesQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{balancesQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="inventory-search">Find cup by SKU, brand, size, or dimension</Label>
            <Input
              id="inventory-search"
              placeholder="Search cups"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {balancesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading live inventory balances...</p>
          ) : null}

          {!balancesQuery.isLoading && filteredBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cups match the current search. Create the SKU first if it does not exist.
            </p>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Dimension</TableHead>
                <TableHead>On hand</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Min stock</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBalances.map((balance) => (
                <TableRow
                  key={balance.cup.id}
                  className="cursor-pointer"
                  data-state={balance.cup.id === selectedCupId ? "selected" : undefined}
                  onClick={() => {
                    setSelectedCupId(balance.cup.id)
                    setIntakeError(null)
                    setIntakeSuccess(null)
                  }}
                >
                  <TableCell className="font-medium">{balance.cup.sku}</TableCell>
                  <TableCell>{balance.cup.brand}</TableCell>
                  <TableCell>{balance.cup.size}</TableCell>
                  <TableCell>{balance.cup.dimension}</TableCell>
                  <TableCell>{balance.on_hand}</TableCell>
                  <TableCell>{balance.reserved}</TableCell>
                  <TableCell
                    className={
                      balance.available < 0 ? "font-semibold text-destructive" : undefined
                    }
                  >
                    {balance.available}
                  </TableCell>
                  <TableCell>{balance.cup.min_stock}</TableCell>
                  <TableCell>
                    <Badge variant={stockStateVariant(balance)}>
                      {stockStateLabel(balance)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={balance.cup.is_active ? "default" : "secondary"}>
                      {balance.cup.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Receive Stock</CardTitle>
          <CardDescription>
            {selectedCup
              ? "Review the selected cup and record a new stock_in movement."
              : "Select a cup from the list before recording stock intake."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {intakeError ? (
            <Alert variant="destructive">
              <AlertDescription>{intakeError}</AlertDescription>
            </Alert>
          ) : null}

          {intakeSuccess ? (
            <Alert>
              <AlertDescription>{intakeSuccess}</AlertDescription>
            </Alert>
          ) : null}

          {selectedCup ? (
            <div className="grid gap-3 border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{selectedCup.sku}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCup.brand} · {selectedCup.size} · {selectedCup.dimension}
                  </p>
                </div>
                <Badge variant={selectedCup.is_active ? "default" : "secondary"}>
                  {selectedCup.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Material: {selectedCup.material ?? "Not set"} | Color: {selectedCup.color ?? "Not set"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No cup selected yet. Pick one from the table to continue.
            </p>
          )}

          <CupField
            label="Quantity"
            type="number"
            value={intakeForm.quantity}
            disabled={!isAdmin}
            onChange={(value) => setIntakeForm({ ...intakeForm, quantity: value })}
          />
          <CupField
            label="Reference"
            value={intakeForm.reference}
            disabled={!isAdmin}
            onChange={(value) => setIntakeForm({ ...intakeForm, reference: value })}
          />
          <CupField
            label="Note"
            value={intakeForm.note}
            disabled={!isAdmin}
            onChange={(value) => setIntakeForm({ ...intakeForm, note: value })}
          />

          <Button
            type="button"
            onClick={submitIntake}
            disabled={!isAdmin || !selectedCup || stockIntake.isPending}
          >
            {stockIntake.isPending ? "Recording..." : "Record stock intake"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function CupField({
  disabled,
  label,
  onChange,
  type = "text",
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  type?: string
  value: string
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function filterBalances(
  balances: InventoryBalance[] | undefined,
  search: string,
): InventoryBalance[] {
  if (!balances) {
    return []
  }

  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch) {
    return balances
  }

  return balances.filter((balance) =>
    [
      balance.cup.sku,
      balance.cup.brand,
      balance.cup.size,
      balance.cup.dimension,
      balance.cup.material ?? "",
      balance.cup.color ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch),
  )
}

function stockStateLabel(balance: InventoryBalance): string {
  if (balance.available < 0) {
    return "Negative"
  }

  if (balance.available <= balance.cup.min_stock) {
    return "Low"
  }

  return "Healthy"
}

function stockStateVariant(balance: InventoryBalance): "default" | "secondary" | "destructive" {
  if (balance.available < 0) {
    return "destructive"
  }

  if (balance.available <= balance.cup.min_stock) {
    return "secondary"
  }

  return "default"
}

function validateCupForm(form: CupPayload): string | null {
  if (!skuSchema.safeParse(form.sku).success) {
    return "Enter a valid SKU. Use letters, numbers, hyphens, or underscores."
  }

  if (!form.brand.trim() || !form.size.trim() || !form.dimension.trim()) {
    return "Brand, size, and dimension are required."
  }

  if (form.min_stock < 0 || !Number.isInteger(form.min_stock)) {
    return "Minimum stock must be a non-negative whole number."
  }

  if (!/^\d+(\.\d{1,2})?$/.test(form.cost_price) || !/^\d+(\.\d{1,2})?$/.test(form.default_sell_price)) {
    return "Prices must be non-negative money values with up to 2 decimals."
  }

  return null
}
