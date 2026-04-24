import { useEffect, useMemo, useState } from "react"

import { Navigate } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch, type DefaultValues } from "react-hook-form"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { appPermissions, getDefaultAuthorizedRoute, hasPermission } from "@/features/auth/permissions"
import type { Cup, CupPayload } from "@/features/cups/api/cups-client"
import { useCreateCupMutation, useCupsQuery, useUpdateCupMutation } from "@/features/cups/hooks/use-cups"
import {
  cupBrands,
  cupColors,
  cupDiameters,
  cupSizes,
  cupTypes,
  formatCupContractLabel,
  getAllowedCupBrands,
  getAllowedCupColors,
  getAllowedCupDiameters,
  getAllowedCupSizes,
} from "@/features/cups/types/cup-contract"
import { generateCupSkuPreview } from "@/features/cups/types/sku"

const cupFormSchema = z
  .object({
    type: z.enum(cupTypes),
    brand: z.enum(cupBrands),
    diameter: z.enum(cupDiameters),
    size: z.enum(cupSizes),
    color: z.enum(cupColors),
    min_stock: z.number().int().nonnegative(),
    cost_price: z.number().nonnegative(),
    default_sell_price: z.number({
      required_error: "Default sell price is required.",
      invalid_type_error: "Default sell price is required.",
    }).nonnegative(),
    is_active: z.boolean(),
  })
  .superRefine((values, context) => {
    if (!getAllowedCupBrands(values.type).includes(values.brand)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brand"],
        message: "Invalid brand for the selected type.",
      })
    }

    if (!getAllowedCupDiameters(values.type, values.brand).includes(values.diameter)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diameter"],
        message: "Invalid diameter for the selected type.",
      })
    }

    if (!getAllowedCupSizes(values.type).includes(values.size)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["size"],
        message: "Invalid size for the selected type.",
      })
    }

    if (!getAllowedCupColors(values.type, values.brand).includes(values.color)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["color"],
        message: "Invalid color for the selected type and brand.",
      })
    }
  })

type CupFormValues = z.infer<typeof cupFormSchema>

const emptyFormValues: DefaultValues<CupFormValues> = {
  type: "plastic",
  brand: "dabba",
  diameter: "95mm",
  size: "12oz",
  color: "transparent",
  min_stock: 0,
  cost_price: 0,
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
  const [search, setSearch] = useState("")
  const [brandFilter, setBrandFilter] = useState("all")
  const [sizeFilter, setSizeFilter] = useState("all")
  const [colorFilter, setColorFilter] = useState("all")
  const canViewCups = hasPermission(currentUser.data, appPermissions.cupsView)
  const canManageCups = hasPermission(currentUser.data, appPermissions.cupsManage)
  const selectedCup = useMemo(
    () => cupsQuery.data?.find((cup) => cup.id === selectedCupId) ?? null,
    [cupsQuery.data, selectedCupId],
  )
  const visibleCups = useMemo(
    () => filterAndSortCups(cupsQuery.data ?? [], { search, brandFilter, sizeFilter, colorFilter }),
    [brandFilter, colorFilter, cupsQuery.data, search, sizeFilter],
  )

  const form = useForm<CupFormValues>({
    resolver: zodResolver(cupFormSchema),
    defaultValues: emptyFormValues,
  })

  const selectedType = useWatch({ control: form.control, name: "type" })
  const selectedBrand = useWatch({ control: form.control, name: "brand" })
  const selectedSize = useWatch({ control: form.control, name: "size" })
  const selectedColor = useWatch({ control: form.control, name: "color" })
  const availableBrands = useMemo(() => getAllowedCupBrands(selectedType), [selectedType])
  const availableDiameters = useMemo(
    () => getAllowedCupDiameters(selectedType, selectedBrand),
    [selectedType, selectedBrand],
  )
  const availableSizes = useMemo(() => getAllowedCupSizes(selectedType), [selectedType])
  const availableColors = useMemo(
    () => getAllowedCupColors(selectedType, selectedBrand),
    [selectedType, selectedBrand],
  )
  const skuPreview = useMemo(
    () =>
      generateCupSkuPreview({
        type: selectedType,
        brand: selectedBrand,
        size: selectedSize,
        color: selectedColor,
      }),
    [selectedType, selectedBrand, selectedSize, selectedColor],
  )

  useEffect(() => {
    if (!dialogOpen) {
      return
    }

    form.reset(selectedCup ? toFormValues(selectedCup) : emptyFormValues)
  }, [dialogOpen, selectedCup, form])

  useEffect(() => {
    const currentBrand = form.getValues("brand")
    if (!availableBrands.includes(currentBrand)) {
      form.setValue("brand", availableBrands[0], { shouldValidate: true })
    }

    const currentDiameter = form.getValues("diameter")
    if (!availableDiameters.includes(currentDiameter)) {
      form.setValue("diameter", availableDiameters[0], { shouldValidate: true })
    }

    const currentSize = form.getValues("size")
    if (!availableSizes.includes(currentSize)) {
      form.setValue("size", availableSizes[0], { shouldValidate: true })
    }
  }, [availableBrands, availableDiameters, availableSizes, form])

  useEffect(() => {
    const currentColor = form.getValues("color")
    if (!availableColors.includes(currentColor)) {
      form.setValue("color", availableColors[0], { shouldValidate: true })
    }
  }, [availableColors, form])

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canViewCups) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/products" && fallbackRoute !== "/cups") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Cup visibility requires cup-view permission.</AlertDescription>
      </Alert>
    )
  }

  async function onSubmit(values: CupFormValues) {
    setSubmitError(null)

    const payload: CupPayload = {
      ...values,
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
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <CardTitle>Cup Catalog</CardTitle>
            <CardDescription>
              SKU is the inventory identity. Contract rules are backend-enforced and mirrored in the form.
            </CardDescription>
          </div>
          {canManageCups ? <Button onClick={openCreateDialog}>Create Cup</Button> : null}
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

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem_10rem_12rem]">
            <div className="grid gap-2">
              <Label htmlFor="cup-search">Search cups</Label>
              <Input
                id="cup-search"
                placeholder="Search SKU, type, brand, size, or color"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <CatalogFilterSelect
              label="Brand"
              value={brandFilter}
              options={cupBrands}
              formatLabel={formatCupContractLabel}
              onValueChange={setBrandFilter}
            />
            <CatalogFilterSelect
              label="Size"
              value={sizeFilter}
              options={cupSizes}
              formatLabel={(value) => value}
              onValueChange={setSizeFilter}
            />
            <CatalogFilterSelect
              label="Color"
              value={colorFilter}
              options={cupColors}
              formatLabel={formatCupContractLabel}
              onValueChange={setColorFilter}
            />
          </div>

          {!cupsQuery.isLoading && cupsQuery.data && cupsQuery.data.length > 0 && visibleCups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cups match the current filters.</p>
          ) : null}

          {visibleCups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Diameter</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Min stock</TableHead>
                  <TableHead>Status</TableHead>
                  {hasPricing(cupsQuery.data) ? <TableHead>Sell price</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCups.map((cup) => (
                  <TableRow
                    key={cup.id}
                    className={canManageCups ? "cursor-pointer" : undefined}
                    onClick={() => {
                      if (canManageCups) {
                        openDetailDialog(cup)
                      }
                    }}
                  >
                    <TableCell className="font-medium">{cup.sku}</TableCell>
                    <TableCell>{formatCupContractLabel(cup.type)}</TableCell>
                    <TableCell>{formatCupContractLabel(cup.brand)}</TableCell>
                    <TableCell>{cup.diameter}</TableCell>
                    <TableCell>{cup.size}</TableCell>
                    <TableCell>{formatCupContractLabel(cup.color)}</TableCell>
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
          ) : null}
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
        <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedCup ? "Cup Detail" : "Create Cup"}</DialogTitle>
            <DialogDescription>
              {canManageCups
                ? "Maintain cup catalog records using the enforced cup contract."
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
                <ReadOnlySkuField value={skuPreview} />
                <SelectFormField
                  control={form.control}
                  disabled={!canManageCups}
                  label="Type"
                  name="type"
                  options={cupTypes}
                />
                <SelectFormField
                  control={form.control}
                  disabled={!canManageCups}
                  label="Brand"
                  name="brand"
                  options={availableBrands}
                />
                <SelectFormField
                  control={form.control}
                  disabled={!canManageCups}
                  label="Size"
                  name="size"
                  options={availableSizes}
                />
                <SelectFormField
                  control={form.control}
                  disabled={!canManageCups}
                  label="Diameter"
                  name="diameter"
                  options={availableDiameters}
                />
                <SelectFormField
                  control={form.control}
                  disabled={!canManageCups}
                  label="Color"
                  name="color"
                  options={availableColors}
                />
                <NumberFormField
                  control={form.control}
                  disabled={!canManageCups}
                  label="Min stock"
                  name="min_stock"
                />
                <CurrencyFormField
                  control={form.control}
                  disabled={!canManageCups}
                  label="Cost price"
                  name="cost_price"
                />
                <CurrencyFormField
                  control={form.control}
                  disabled={!canManageCups}
                  label="Default sell price"
                  name="default_sell_price"
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        disabled={!canManageCups}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                    </FormControl>
                    <div className="grid gap-1">
                      <FormLabel>Active catalog record</FormLabel>
                      <FormDescription>
                        Inactive cups remain visible but should not be used for new operational work.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter showCloseButton>
                {canManageCups ? (
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

function ReadOnlySkuField({ value }: { value: string }) {
  return (
    <FormItem>
      <FormLabel>SKU</FormLabel>
      <FormControl>
        <Input disabled readOnly value={value} />
      </FormControl>
    </FormItem>
  )
}

function SelectFormField({
  control,
  disabled,
  label,
  name,
  options,
}: {
  control: ReturnType<typeof useForm<CupFormValues>>["control"]
  disabled: boolean
  label: string
  name: "type" | "brand" | "diameter" | "size" | "color"
  options: readonly string[]
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select disabled={disabled} value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {formatCupContractLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  const preserveEmptyValue = name === "default_sell_price"

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
              onChange={(value) => field.onChange(preserveEmptyValue ? value : (value ?? 0))}
            />
          </FormControl>
        </FormItem>
      )}
    />
  )
}

function hasPricing(cups: Cup[] | undefined): boolean {
  return Boolean(cups?.some((cup) => "default_sell_price" in cup))
}

function CatalogFilterSelect({
  label,
  value,
  options,
  formatLabel,
  onValueChange,
}: {
  label: string
  value: string
  options: readonly string[]
  formatLabel: (value: string) => string
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
              {formatLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function filterAndSortCups(
  cups: Cup[],
  filters: {
    search: string
    brandFilter: string
    sizeFilter: string
    colorFilter: string
  },
): Cup[] {
  const normalizedSearch = filters.search.trim().toLowerCase()

  return [...cups]
    .sort((left, right) => left.sku.localeCompare(right.sku, undefined, { numeric: true }))
    .filter((cup) => {
      if (filters.brandFilter !== "all" && cup.brand !== filters.brandFilter) {
        return false
      }

      if (filters.sizeFilter !== "all" && cup.size !== filters.sizeFilter) {
        return false
      }

      if (filters.colorFilter !== "all" && cup.color !== filters.colorFilter) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return [
        cup.sku,
        cup.type,
        formatCupContractLabel(cup.type),
        cup.brand,
        formatCupContractLabel(cup.brand),
        cup.diameter,
        cup.size,
        cup.color,
        formatCupContractLabel(cup.color),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    })
}

function toFormValues(cup: Cup): CupFormValues {
  return {
    type: cup.type,
    brand: cup.brand,
    diameter: cup.diameter,
    size: cup.size,
    color: cup.color,
    min_stock: cup.min_stock,
    cost_price: Number(cup.cost_price ?? 0),
    default_sell_price: Number(cup.default_sell_price ?? 0),
    is_active: cup.is_active,
  }
}
