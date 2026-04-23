import { useEffect, useMemo, useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
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
import { useCreateCupMutation, useCupsQuery, useUpdateCupMutation } from "@/features/cups/hooks/use-cups"
import { normalizeSku, skuSchema } from "@/features/cups/types/sku"

const cupFormSchema = z.object({
  sku: skuSchema,
  brand: z.string().trim().min(1).max(160),
  size: z.string().trim().min(1).max(80),
  dimension: z.string().trim().min(1).max(120),
  material: z.string().trim().max(80).optional(),
  color: z.string().trim().max(80).optional(),
  min_stock: z.number().int().nonnegative(),
  cost_price: z.number().nonnegative(),
  default_sell_price: z.number().nonnegative(),
  is_active: z.boolean(),
})

type CupFormValues = z.infer<typeof cupFormSchema>

const emptyFormValues: CupFormValues = {
  sku: "",
  brand: "",
  size: "",
  dimension: "",
  material: "",
  color: "",
  min_stock: 0,
  cost_price: 0,
  default_sell_price: 0,
  is_active: true,
}

export function CupsPage() {
  const currentUser = useCurrentUser()
  const cupsQuery = useCupsQuery()
  const createCup = useCreateCupMutation()
  const updateCup = useUpdateCupMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCupId, setSelectedCupId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isAdmin = currentUser.data?.role === "admin"
  const selectedCup = useMemo(
    () => cupsQuery.data?.find((cup) => cup.id === selectedCupId) ?? null,
    [cupsQuery.data, selectedCupId],
  )

  const form = useForm<CupFormValues>({
    resolver: zodResolver(cupFormSchema),
    defaultValues: emptyFormValues,
  })

  useEffect(() => {
    if (!dialogOpen) {
      return
    }

    form.reset(selectedCup ? toFormValues(selectedCup) : emptyFormValues)
  }, [dialogOpen, selectedCup, form])

  async function onSubmit(values: CupFormValues) {
    setSubmitError(null)

    const payload: CupPayload = {
      ...values,
      sku: normalizeSku(values.sku),
      material: values.material?.trim() || undefined,
      color: values.color?.trim() || undefined,
      cost_price: values.cost_price.toFixed(2),
      default_sell_price: values.default_sell_price.toFixed(2),
    }

    try {
      if (selectedCup) {
        await updateCup.mutateAsync({ id: selectedCup.id, payload })
      } else {
        await createCup.mutateAsync(payload)
      }

      setDialogOpen(false)
      setSelectedCupId(null)
      form.reset(emptyFormValues)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save cup.")
    }
  }

  function openCreateDialog() {
    setSelectedCupId(null)
    setDialogOpen(true)
  }

  function openDetailDialog(cup: Cup) {
    setSelectedCupId(cup.id)
    setDialogOpen(true)
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-none">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <CardTitle>Cup Catalog</CardTitle>
            <CardDescription>
              SKU is the inventory identity. Staff payloads omit cost and sell price fields.
            </CardDescription>
          </div>
          {isAdmin ? <Button onClick={openCreateDialog}>Create Cup</Button> : null}
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
                  onClick={() => openDetailDialog(cup)}
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setSelectedCupId(null)
            form.reset(emptyFormValues)
            setSubmitError(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCup ? "Cup Detail" : "Create Cup"}</DialogTitle>
            <DialogDescription>
              {isAdmin
                ? "Maintain cup catalog records with shared form primitives."
                : "Staff can inspect cup records but cannot edit catalog data."}
            </DialogDescription>
          </DialogHeader>

          {submitError ? (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextFormField control={form.control} disabled={!isAdmin} label="SKU" name="sku" />
                <TextFormField control={form.control} disabled={!isAdmin} label="Brand" name="brand" />
                <TextFormField control={form.control} disabled={!isAdmin} label="Size" name="size" />
                <TextFormField control={form.control} disabled={!isAdmin} label="Dimension" name="dimension" />
                <TextFormField control={form.control} disabled={!isAdmin} label="Material" name="material" />
                <TextFormField control={form.control} disabled={!isAdmin} label="Color" name="color" />
                <NumberFormField
                  control={form.control}
                  disabled={!isAdmin}
                  label="Min stock"
                  name="min_stock"
                />
                <CurrencyFormField
                  control={form.control}
                  disabled={!isAdmin}
                  label="Cost price"
                  name="cost_price"
                />
                <CurrencyFormField
                  control={form.control}
                  disabled={!isAdmin}
                  label="Default sell price"
                  name="default_sell_price"
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 rounded-none border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        disabled={!isAdmin}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                    </FormControl>
                    <div className="grid gap-1">
                      <FormLabel>Active catalog record</FormLabel>
                      <FormDescription>Inactive cups remain visible but should not be used for new operational work.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter showCloseButton>
                {isAdmin ? (
                  <Button type="submit" disabled={createCup.isPending || updateCup.isPending}>
                    {selectedCup ? "Save Changes" : "Create Cup"}
                  </Button>
                ) : null}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TextFormField({
  control,
  disabled,
  label,
  name,
}: {
  control: ReturnType<typeof useForm<CupFormValues>>["control"]
  disabled: boolean
  label: string
  name: keyof CupFormValues
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              disabled={disabled}
              value={typeof field.value === "string" ? field.value : ""}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function NumberFormField({
  control,
  disabled,
  label,
  name,
}: {
  control: ReturnType<typeof useForm<CupFormValues>>["control"]
  disabled: boolean
  label: string
  name: "min_stock"
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input.Number
              disabled={disabled}
              min={0}
              value={field.value}
              onChange={(value) => field.onChange(value ?? 0)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CurrencyFormField({
  control,
  disabled,
  label,
  name,
}: {
  control: ReturnType<typeof useForm<CupFormValues>>["control"]
  disabled: boolean
  label: string
  name: "cost_price" | "default_sell_price"
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input.Currency
              disabled={disabled}
              min={0}
              value={field.value}
              onChange={(value) => field.onChange(value ?? 0)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function hasPricing(cups: Cup[] | undefined): boolean {
  return Boolean(cups?.some((cup) => "default_sell_price" in cup))
}

function toFormValues(cup: Cup): CupFormValues {
  return {
    sku: cup.sku,
    brand: cup.brand,
    size: cup.size,
    dimension: cup.dimension,
    material: cup.material ?? "",
    color: cup.color ?? "",
    min_stock: cup.min_stock,
    cost_price: Number(cup.cost_price ?? 0),
    default_sell_price: Number(cup.default_sell_price ?? 0),
    is_active: cup.is_active,
  }
}
