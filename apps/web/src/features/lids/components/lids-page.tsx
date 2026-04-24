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
import type { Lid, LidPayload } from "@/features/lids/api/lids-client"
import { useCreateLidMutation, useLidsQuery, useUpdateLidMutation } from "@/features/lids/hooks/use-lids"
import {
  formatLidContractLabel,
  getAllowedLidBrands,
  getAllowedLidColors,
  getAllowedLidDiameters,
  getAllowedLidShapes,
  lidBrands,
  lidColors,
  lidDiameters,
  lidShapes,
  lidTypes,
} from "@/features/lids/types/lid-contract"
import { generateLidSkuPreview } from "@/features/lids/types/sku"

const lidFormSchema = z
  .object({
    type: z.enum(lidTypes),
    brand: z.enum(lidBrands),
    diameter: z.enum(lidDiameters),
    shape: z.enum(lidShapes),
    color: z.enum(lidColors),
    cost_price: z.number().nonnegative(),
    default_sell_price: z.number({
      required_error: "Default sell price is required.",
      invalid_type_error: "Default sell price is required.",
    }).nonnegative(),
    is_active: z.boolean(),
  })
  .superRefine((values, context) => {
    if (!getAllowedLidBrands(values.type).includes(values.brand)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brand"],
        message: "Invalid brand for the selected type.",
      })
    }

    if (!getAllowedLidDiameters(values.type).includes(values.diameter)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diameter"],
        message: "Invalid diameter for the selected type.",
      })
    }

    if (!getAllowedLidShapes(values.type).includes(values.shape)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shape"],
        message: "Invalid shape for the selected type.",
      })
    }

    if (!getAllowedLidColors(values.type).includes(values.color)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["color"],
        message: "Invalid color for the selected type.",
      })
    }
  })

type LidFormValues = z.infer<typeof lidFormSchema>

const emptyFormValues: DefaultValues<LidFormValues> = {
  type: "plastic",
  brand: "dabba",
  diameter: "95mm",
  shape: "dome",
  color: "transparent",
  cost_price: 0,
  is_active: true,
}

export function LidsPage() {
  const currentUser = useCurrentUser()
  const lidsQuery = useLidsQuery()
  const createLid = useCreateLidMutation()
  const updateLid = useUpdateLidMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedLidId, setSelectedLidId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const canViewLids = hasPermission(currentUser.data, appPermissions.lidsView)
  const canManageLids = hasPermission(currentUser.data, appPermissions.lidsManage)
  const selectedLid = useMemo(
    () => lidsQuery.data?.find((lid) => lid.id === selectedLidId) ?? null,
    [lidsQuery.data, selectedLidId],
  )

  const form = useForm<LidFormValues>({
    resolver: zodResolver(lidFormSchema),
    defaultValues: emptyFormValues,
  })

  const selectedType = useWatch({ control: form.control, name: "type" })
  const selectedBrand = useWatch({ control: form.control, name: "brand" })
  const selectedDiameter = useWatch({ control: form.control, name: "diameter" })
  const selectedShape = useWatch({ control: form.control, name: "shape" })
  const selectedColor = useWatch({ control: form.control, name: "color" })
  const availableBrands = useMemo(() => getAllowedLidBrands(selectedType), [selectedType])
  const availableDiameters = useMemo(() => getAllowedLidDiameters(selectedType), [selectedType])
  const availableShapes = useMemo(() => getAllowedLidShapes(selectedType), [selectedType])
  const availableColors = useMemo(() => getAllowedLidColors(selectedType), [selectedType])
  const skuPreview = useMemo(
    () =>
      generateLidSkuPreview({
        diameter: selectedDiameter,
        brand: selectedBrand,
        shape: selectedShape,
        color: selectedColor,
      }),
    [selectedDiameter, selectedBrand, selectedShape, selectedColor],
  )

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canViewLids) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/products" && fallbackRoute !== "/lids") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Lid visibility requires lid-view permission.</AlertDescription>
      </Alert>
    )
  }

  useEffect(() => {
    if (!dialogOpen) {
      return
    }

    form.reset(selectedLid ? toFormValues(selectedLid) : emptyFormValues)
  }, [dialogOpen, selectedLid, form])

  useEffect(() => {
    const currentBrand = form.getValues("brand")
    if (!availableBrands.includes(currentBrand)) {
      form.setValue("brand", availableBrands[0], { shouldValidate: true })
    }

    const currentDiameter = form.getValues("diameter")
    if (!availableDiameters.includes(currentDiameter)) {
      form.setValue("diameter", availableDiameters[0], { shouldValidate: true })
    }

    const currentShape = form.getValues("shape")
    if (!availableShapes.includes(currentShape)) {
      form.setValue("shape", availableShapes[0], { shouldValidate: true })
    }

    const currentColor = form.getValues("color")
    if (!availableColors.includes(currentColor)) {
      form.setValue("color", availableColors[0], { shouldValidate: true })
    }
  }, [availableBrands, availableColors, availableDiameters, availableShapes, form])

  async function onSubmit(values: LidFormValues) {
    setSubmitError(null)

    const payload: LidPayload = {
      ...values,
      cost_price: values.cost_price.toFixed(2),
      default_sell_price: values.default_sell_price.toFixed(2),
    }

    try {
      if (selectedLid) {
        await updateLid.mutateAsync({ id: selectedLid.id, payload })
      } else {
        await createLid.mutateAsync(payload)
      }

      setDialogOpen(false)
      setSelectedLidId(null)
      form.reset(emptyFormValues)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save lid.")
    }
  }

  function openCreateDialog() {
    setSelectedLidId(null)
    setDialogOpen(true)
  }

  function openDetailDialog(lid: Lid) {
    setSelectedLidId(lid.id)
    setDialogOpen(true)
  }
  
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <CardTitle>Lids Catalog</CardTitle>
            <CardDescription>
              Lids are first-class master data. Production progress does not apply here.
            </CardDescription>
          </div>
          {canManageLids ? <Button onClick={openCreateDialog}>Create Lid</Button> : null}
        </CardHeader>
        <CardContent className="grid gap-4">
          {lidsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading lids catalog...</p>
          ) : null}

          {!lidsQuery.isLoading && lidsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lids found. Admins can create the first lid record.</p>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Diameter</TableHead>
                <TableHead>Shape</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Status</TableHead>
                {hasPricing(lidsQuery.data) ? <TableHead>Sell price</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lidsQuery.data?.map((lid) => (
                <TableRow
                  key={lid.id}
                  className={canManageLids ? "cursor-pointer" : undefined}
                  onClick={() => {
                    if (canManageLids) {
                      openDetailDialog(lid)
                    }
                  }}
                >
                  <TableCell className="font-medium">{lid.sku}</TableCell>
                  <TableCell>{formatLidContractLabel(lid.type)}</TableCell>
                  <TableCell>{formatLidContractLabel(lid.brand)}</TableCell>
                  <TableCell>{lid.diameter}</TableCell>
                  <TableCell>{formatLidContractLabel(lid.shape)}</TableCell>
                  <TableCell>{formatLidContractLabel(lid.color)}</TableCell>
                  <TableCell>
                    <Badge variant={lid.is_active ? "default" : "secondary"}>
                      {lid.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {hasPricing(lidsQuery.data) ? (
                    <TableCell>{lid.default_sell_price ?? "Restricted"}</TableCell>
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
            setSelectedLidId(null)
            form.reset(emptyFormValues)
            setSubmitError(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedLid ? "Lid Detail" : "Create Lid"}</DialogTitle>
            <DialogDescription>
              {canManageLids
                ? "Maintain lid catalog records using the enforced lid contract."
                : "Staff can inspect lid records but cannot edit catalog data."}
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
                <SelectFormField control={form.control} disabled={!canManageLids} label="Type" name="type" options={lidTypes} />
                <SelectFormField control={form.control} disabled={!canManageLids} label="Brand" name="brand" options={availableBrands} />
                <SelectFormField control={form.control} disabled={!canManageLids} label="Diameter" name="diameter" options={availableDiameters} />
                <SelectFormField control={form.control} disabled={!canManageLids} label="Shape" name="shape" options={availableShapes} />
                <SelectFormField control={form.control} disabled={!canManageLids} label="Color" name="color" options={availableColors} />
                <CurrencyFormField control={form.control} disabled={!canManageLids} label="Cost price" name="cost_price" />
                <CurrencyFormField control={form.control} disabled={!canManageLids} label="Default sell price" name="default_sell_price" />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        disabled={!canManageLids}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                    </FormControl>
                    <div className="grid gap-1">
                      <FormLabel>Active catalog record</FormLabel>
                      <FormDescription>
                        Inactive lids remain visible but should not be used for new operational work.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter showCloseButton>
                {canManageLids ? (
                  <Button type="submit" disabled={createLid.isPending || updateLid.isPending}>
                    {selectedLid ? "Save Changes" : "Create Lid"}
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
  control: ReturnType<typeof useForm<LidFormValues>>["control"]
  disabled: boolean
  label: string
  name: "type" | "brand" | "diameter" | "shape" | "color"
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
                  {formatLidContractLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  control: ReturnType<typeof useForm<LidFormValues>>["control"]
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

function hasPricing(lids: Lid[] | undefined): boolean {
  return Boolean(lids?.some((lid) => "default_sell_price" in lid))
}

function toFormValues(lid: Lid): LidFormValues {
  return {
    type: lid.type,
    brand: lid.brand,
    diameter: lid.diameter,
    shape: lid.shape,
    color: lid.color,
    cost_price: Number(lid.cost_price ?? 0),
    default_sell_price: Number(lid.default_sell_price ?? 0),
    is_active: lid.is_active,
  }
}
