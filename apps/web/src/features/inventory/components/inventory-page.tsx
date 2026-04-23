import { useMemo, useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "@tanstack/react-router"
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
  FormMessage,
} from "@workspace/ui/components/form"
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
import type { InventoryBalance } from "@/features/inventory/api/inventory-client"
import {
  useInventoryBalancesQuery,
  useStockIntakeMutation,
} from "@/features/inventory/hooks/use-inventory"

const stockIntakeFormSchema = z.object({
  quantity: z.number().int().positive("Quantity must be a positive whole number."),
  reference: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
})

type StockIntakeFormValues = z.infer<typeof stockIntakeFormSchema>

const emptyFormValues: StockIntakeFormValues = {
  quantity: 0,
  reference: "",
  note: "",
}

export function InventoryPage() {
  const currentUser = useCurrentUser()
  const balancesQuery = useInventoryBalancesQuery()
  const stockIntake = useStockIntakeMutation()
  const [search, setSearch] = useState("")
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isAdmin = currentUser.data?.role === "admin"

  const form = useForm<StockIntakeFormValues>({
    resolver: zodResolver(stockIntakeFormSchema),
    defaultValues: emptyFormValues,
  })

  const filteredBalances = useMemo(
    () => filterBalances(balancesQuery.data, search),
    [balancesQuery.data, search],
  )

  const selectedBalance = useMemo(
    () =>
      balancesQuery.data?.find((balance) => toInventoryItemKey(balance) === selectedItemKey) ?? null,
    [balancesQuery.data, selectedItemKey],
  )

  async function onSubmit(values: StockIntakeFormValues) {
    if (!selectedBalance) {
      setSubmitError("Select a tracked item before recording stock intake.")
      setSubmitSuccess(null)
      return
    }

    if (!isInventoryItemActive(selectedBalance)) {
      setSubmitError("Inactive items cannot receive stock intake.")
      setSubmitSuccess(null)
      return
    }

    setSubmitError(null)
    setSubmitSuccess(null)

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
      setSubmitSuccess(
        `Recorded ${values.quantity} units as stock_in for ${formatInventoryItemLabel(selectedBalance)}.`,
      )
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to record stock intake.")
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <Card className="rounded-none">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-1">
              <CardTitle>Inventory Balances</CardTitle>
              <CardDescription>
                Cups and lids now share the same movement-ledger model. Stock intake writes a real <code>stock_in</code> movement.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild type="button" variant="outline">
                <Link to="/inventory-history">View movement history</Link>
              </Button>
              {isAdmin ? (
                <>
                  <Button asChild type="button" variant="outline">
                    <Link to="/cups">Create cup in catalog</Link>
                  </Button>
                  <Button asChild type="button" variant="outline">
                    <Link to="/lids">Create lid in catalog</Link>
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {currentUser.data && !isAdmin ? (
            <Alert>
              <AlertDescription>
                Your account can inspect stock balances, but stock intake remains admin-only.
              </AlertDescription>
            </Alert>
          ) : null}

          {balancesQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{balancesQuery.error.message}</AlertDescription>
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
        </CardHeader>
        <CardContent className="grid gap-4">
          {balancesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading live inventory balances...</p>
          ) : null}

          {!balancesQuery.isLoading && filteredBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tracked items match the current search.
            </p>
          ) : null}

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBalances.map((balance) => (
                <TableRow
                  key={toInventoryItemKey(balance)}
                  className="cursor-pointer"
                  data-state={toInventoryItemKey(balance) === selectedItemKey ? "selected" : undefined}
                  onClick={() => {
                    setSelectedItemKey(toInventoryItemKey(balance))
                    setSubmitError(null)
                    setSubmitSuccess(null)
                  }}
                >
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
                    {balance.item_type === "cup" ? balance.cup.min_stock : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={stockStateVariant(balance)}>{stockStateLabel(balance)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isInventoryItemActive(balance) ? "default" : "secondary"}>
                      {isInventoryItemActive(balance) ? "Active" : "Inactive"}
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
            {selectedBalance
              ? "Review the selected tracked item and record a new stock_in movement."
              : "Select a tracked item from the list before recording stock intake."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {submitError ? (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          {submitSuccess ? (
            <Alert>
              <AlertDescription>{submitSuccess}</AlertDescription>
            </Alert>
          ) : null}

          {selectedBalance ? (
            <div className="grid gap-3 border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="grid gap-1">
                  <p className="text-sm font-medium">{formatInventoryItemLabel(selectedBalance)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatInventoryItemSecondaryLabel(selectedBalance)}
                  </p>
                </div>
                <Badge variant={isInventoryItemActive(selectedBalance) ? "default" : "secondary"}>
                  {isInventoryItemActive(selectedBalance) ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tracked item selected yet. Pick one from the table to continue.
            </p>
          )}

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
                        disabled={!isAdmin}
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
                      <Input disabled={!isAdmin} {...field} value={field.value ?? ""} />
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
                      <Input disabled={!isAdmin} {...field} value={field.value ?? ""} />
                    </FormControl>
                    
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={!isAdmin || !selectedBalance || stockIntake.isPending}
              >
                {stockIntake.isPending ? "Recording..." : "Record stock intake"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
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
    [balance.item_type, formatInventoryItemLabel(balance), formatInventoryItemSecondaryLabel(balance)]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch),
  )
}

function formatInventoryItemLabel(balance: InventoryBalance): string {
  if (balance.item_type === "cup") {
    return balance.cup.sku
  }

  return `${balance.lid.type} ${balance.lid.brand} ${balance.lid.diameter} ${balance.lid.shape} ${balance.lid.color}`
}

function formatInventoryItemPrimaryLabel(balance: InventoryBalance): string {
  if (balance.item_type === "cup") {
    return balance.cup.sku
  }

  return `${balance.lid.diameter} ${balance.lid.shape}`
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

  return "Healthy"
}

function stockStateVariant(balance: InventoryBalance): "default" | "secondary" | "destructive" {
  if (balance.available < 0) {
    return "destructive"
  }

  if (balance.item_type === "cup" && balance.available <= balance.cup.min_stock) {
    return "secondary"
  }

  return "default"
}

function toInventoryItemKey(balance: InventoryBalance): string {
  return balance.item_type === "cup" ? `cup:${balance.cup.id}` : `lid:${balance.lid.id}`
}
