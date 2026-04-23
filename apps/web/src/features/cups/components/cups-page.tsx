import { useMemo, useState } from "react"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
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
import type { Cup, CupPayload } from "@/features/cups/api/cups-client"
import {
  useCreateCupMutation,
  useCupsQuery,
  useUpdateCupMutation,
} from "@/features/cups/hooks/use-cups"
import { normalizeSku, skuSchema } from "@/features/cups/types/sku"

const emptyForm: CupPayload = {
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

export function CupsPage() {
  const currentUser = useCurrentUser()
  const cupsQuery = useCupsQuery()
  const createCup = useCreateCupMutation()
  const updateCup = useUpdateCupMutation()
  const [selectedCupId, setSelectedCupId] = useState<string | null>(null)
  const [form, setForm] = useState<CupPayload>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const selectedCup = useMemo(
    () => cupsQuery.data?.find((cup) => cup.id === selectedCupId) ?? null,
    [cupsQuery.data, selectedCupId],
  )
  const isAdmin = currentUser.data?.role === "admin"

  const saveCup = () => {
    const validation = validateForm(form)

    setFormError(validation)

    if (validation) {
      return
    }

    const payload = {
      ...form,
      sku: normalizeSku(form.sku),
      material: form.material || undefined,
      color: form.color || undefined,
    }

    if (selectedCup) {
      updateCup.mutate(
        { id: selectedCup.id, payload },
        {
          onError: (error) => setFormError(error.message),
        },
      )
      return
    }

    createCup.mutate(payload, {
      onError: (error) => setFormError(error.message),
      onSuccess: () => {
        setForm(emptyForm)
      },
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Cup Catalog</CardTitle>
          <CardDescription>
            SKU is the inventory identity. Staff payloads omit cost and sell price fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {cupsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{cupsQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {cupsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading cup catalog...</p>
          ) : null}

          {!cupsQuery.isLoading && cupsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cups found. Admins can create the first SKU.</p>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Dimension</TableHead>
                <TableHead>Min stock</TableHead>
                <TableHead>Status</TableHead>
                {hasPricing(cupsQuery.data) ? <TableHead>Sell price</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cupsQuery.data?.map((cup) => (
                <TableRow
                  key={cup.id}
                  className="cursor-pointer"
                  data-state={cup.id === selectedCupId ? "selected" : undefined}
                  onClick={() => {
                    setSelectedCupId(cup.id)
                    setForm(toFormState(cup))
                    setFormError(null)
                  }}
                >
                  <TableCell className="font-medium">{cup.sku}</TableCell>
                  <TableCell>{cup.brand}</TableCell>
                  <TableCell>{cup.size}</TableCell>
                  <TableCell>{cup.dimension}</TableCell>
                  <TableCell>{cup.min_stock}</TableCell>
                  <TableCell>
                    <Badge variant={cup.is_active ? "default" : "secondary"}>
                      {cup.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {hasPricing(cupsQuery.data) ? (
                    <TableCell>{cup.default_sell_price ?? "Restricted"}</TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>{selectedCup ? "Cup Detail" : "Create Cup"}</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Admins can create and edit catalog records."
              : "Staff can inspect SKU records but cannot edit catalog data."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <CupField label="SKU" value={form.sku} disabled={!isAdmin} onChange={(value) => setForm({ ...form, sku: value })} />
          <CupField label="Brand" value={form.brand} disabled={!isAdmin} onChange={(value) => setForm({ ...form, brand: value })} />
          <CupField label="Size" value={form.size} disabled={!isAdmin} onChange={(value) => setForm({ ...form, size: value })} />
          <CupField label="Dimension" value={form.dimension} disabled={!isAdmin} onChange={(value) => setForm({ ...form, dimension: value })} />
          <CupField label="Material" value={form.material ?? ""} disabled={!isAdmin} onChange={(value) => setForm({ ...form, material: value })} />
          <CupField label="Color" value={form.color ?? ""} disabled={!isAdmin} onChange={(value) => setForm({ ...form, color: value })} />
          <CupField label="Min stock" type="number" value={String(form.min_stock)} disabled={!isAdmin} onChange={(value) => setForm({ ...form, min_stock: Number(value) })} />

          {isAdmin ? (
            <>
              <CupField label="Cost price" value={form.cost_price} onChange={(value) => setForm({ ...form, cost_price: value })} />
              <CupField label="Default sell price" value={form.default_sell_price} onChange={(value) => setForm({ ...form, default_sell_price: value })} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                />
                Active catalog record
              </label>
              <div className="flex gap-2">
                <Button type="button" onClick={saveCup} disabled={createCup.isPending || updateCup.isPending}>
                  {selectedCup ? "Save Changes" : "Create Cup"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedCupId(null)
                    setForm(emptyForm)
                    setFormError(null)
                  }}
                >
                  New
                </Button>
              </div>
            </>
          ) : null}
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

function hasPricing(cups: Cup[] | undefined): boolean {
  return Boolean(cups?.some((cup) => "default_sell_price" in cup))
}

function toFormState(cup: Cup): CupPayload {
  return {
    sku: cup.sku,
    brand: cup.brand,
    size: cup.size,
    dimension: cup.dimension,
    material: cup.material ?? "",
    color: cup.color ?? "",
    min_stock: cup.min_stock,
    cost_price: cup.cost_price ?? "0",
    default_sell_price: cup.default_sell_price ?? "0",
    is_active: cup.is_active,
  }
}

function validateForm(form: CupPayload): string | null {
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
