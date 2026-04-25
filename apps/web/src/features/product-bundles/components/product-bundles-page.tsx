import { useEffect, useMemo, useState } from "react"

import { Navigate } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch, type DefaultValues } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { Textarea } from "@workspace/ui/components/textarea"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { appPermissions, getDefaultAuthorizedRoute, hasPermission } from "@/features/auth/permissions"
import type { Cup } from "@/features/cups/api/cups-client"
import { useCupsQuery } from "@/features/cups/hooks/use-cups"
import type { Lid } from "@/features/lids/api/lids-client"
import { useLidsQuery } from "@/features/lids/hooks/use-lids"
import type {
  ProductBundle,
  ProductBundlePayload,
} from "@/features/product-bundles/api/product-bundles-client"
import {
  useCreateProductBundleMutation,
  useProductBundlesQuery,
  useUpdateProductBundleMutation,
} from "@/features/product-bundles/hooks/use-product-bundles"

const noneValue = "__none__"

const productBundleFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(180),
    description: z.string().trim().max(800).optional(),
    cup_id: z.string(),
    lid_id: z.string(),
    cup_qty_per_set: z.number().int().nonnegative(),
    lid_qty_per_set: z.number().int().nonnegative(),
    is_active: z.boolean(),
  })
  .superRefine((values, context) => {
    const hasCup = values.cup_id !== noneValue
    const hasLid = values.lid_id !== noneValue

    if (!hasCup && !hasLid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cup_id"],
        message: "Select at least one cup or lid component.",
      })
    }

    if (hasCup && values.cup_qty_per_set <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cup_qty_per_set"],
        message: "Cup quantity must be greater than 0.",
      })
    }

    if (!hasCup && values.cup_qty_per_set !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cup_qty_per_set"],
        message: "Cup quantity must be 0 when no cup is selected.",
      })
    }

    if (hasLid && values.lid_qty_per_set <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lid_qty_per_set"],
        message: "Lid quantity must be greater than 0.",
      })
    }

    if (!hasLid && values.lid_qty_per_set !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lid_qty_per_set"],
        message: "Lid quantity must be 0 when no lid is selected.",
      })
    }
  })

type ProductBundleFormValues = z.infer<typeof productBundleFormSchema>

const emptyFormValues: DefaultValues<ProductBundleFormValues> = {
  name: "",
  description: "",
  cup_id: noneValue,
  lid_id: noneValue,
  cup_qty_per_set: 0,
  lid_qty_per_set: 0,
  is_active: true,
}

export function ProductBundlesPage() {
  const currentUser = useCurrentUser()
  const productBundlesQuery = useProductBundlesQuery()
  const cupsQuery = useCupsQuery()
  const lidsQuery = useLidsQuery()
  const createProductBundle = useCreateProductBundleMutation()
  const updateProductBundle = useUpdateProductBundleMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const canViewBundles = hasPermission(currentUser.data, appPermissions.productBundlesView)
  const canManageBundles = hasPermission(currentUser.data, appPermissions.productBundlesManage)
  const selectedBundle = useMemo(
    () => productBundlesQuery.data?.find((bundle) => bundle.id === selectedBundleId) ?? null,
    [productBundlesQuery.data, selectedBundleId],
  )
  const visibleBundles = useMemo(
    () =>
      filterAndSortBundles(
        productBundlesQuery.data ?? [],
        search,
        cupsQuery.data ?? [],
        lidsQuery.data ?? [],
      ),
    [cupsQuery.data, lidsQuery.data, productBundlesQuery.data, search],
  )

  const form = useForm<ProductBundleFormValues>({
    resolver: zodResolver(productBundleFormSchema),
    defaultValues: emptyFormValues,
  })

  const selectedCupId = useWatch({ control: form.control, name: "cup_id" })
  const selectedLidId = useWatch({ control: form.control, name: "lid_id" })

  useEffect(() => {
    if (!dialogOpen) {
      return
    }

    form.reset(selectedBundle ? toFormValues(selectedBundle) : emptyFormValues)
  }, [dialogOpen, form, selectedBundle])

  useEffect(() => {
    if (selectedCupId === noneValue) {
      form.setValue("cup_qty_per_set", 0, { shouldValidate: true })
    } else if (form.getValues("cup_qty_per_set") === 0) {
      form.setValue("cup_qty_per_set", 1, { shouldValidate: true })
    }
  }, [form, selectedCupId])

  useEffect(() => {
    if (selectedLidId === noneValue) {
      form.setValue("lid_qty_per_set", 0, { shouldValidate: true })
    } else if (form.getValues("lid_qty_per_set") === 0) {
      form.setValue("lid_qty_per_set", 1, { shouldValidate: true })
    }
  }, [form, selectedLidId])

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canViewBundles) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/products") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Bundle visibility requires product-bundle-view permission.</AlertDescription>
      </Alert>
    )
  }

  async function onSubmit(values: ProductBundleFormValues) {
    setSubmitError(null)

    const payload: ProductBundlePayload = {
      name: values.name.trim(),
      description: values.description?.trim() ? values.description.trim() : null,
      cup_id: values.cup_id === noneValue ? null : values.cup_id,
      lid_id: values.lid_id === noneValue ? null : values.lid_id,
      cup_qty_per_set: values.cup_qty_per_set,
      lid_qty_per_set: values.lid_qty_per_set,
      is_active: values.is_active,
    }

    try {
      if (selectedBundle) {
        await updateProductBundle.mutateAsync({ id: selectedBundle.id, payload })
      } else {
        await createProductBundle.mutateAsync(payload)
      }

      setDialogOpen(false)
      setSelectedBundleId(null)
      form.reset(emptyFormValues)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save product bundle.")
    }
  }

  function openCreateDialog() {
    setSelectedBundleId(null)
    setDialogOpen(true)
  }

  function openDetailDialog(bundle: ProductBundle) {
    setSelectedBundleId(bundle.id)
    setDialogOpen(true)
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <CardTitle>Bundles</CardTitle>
            <CardDescription>
              Commercial products customers buy, backed by internal cup and lid components.
            </CardDescription>
          </div>
          {canManageBundles ? <Button onClick={openCreateDialog}>Create Bundle</Button> : null}
        </CardHeader>
        <CardContent className="grid gap-4">
          {productBundlesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading bundles...</p>
          ) : null}

          {productBundlesQuery.isError ? (
            <Alert>
              <AlertDescription>
                {productBundlesQuery.error instanceof Error
                  ? productBundlesQuery.error.message
                  : "Unable to load product bundles."}
              </AlertDescription>
            </Alert>
          ) : null}

          {!productBundlesQuery.isLoading && productBundlesQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No bundles found. Admins can create the first commercial bundle.
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="bundle-search">Search bundles</Label>
            <Input
              id="bundle-search"
              placeholder="Search name, description, or component SKU"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {visibleBundles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cup</TableHead>
                  <TableHead>Lid</TableHead>
                  <TableHead>Set qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleBundles.map((bundle) => (
                  <TableRow
                    key={bundle.id}
                    className={canManageBundles ? "cursor-pointer" : undefined}
                    onClick={() => {
                      if (canManageBundles) {
                        openDetailDialog(bundle)
                      }
                    }}
                  >
                    <TableCell>
                      <div className="grid gap-1">
                        <span className="font-medium">{bundle.name}</span>
                        {bundle.description ? (
                          <span className="text-sm text-muted-foreground">{bundle.description}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={bundle.is_active ? "default" : "secondary"}>
                        {bundle.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCupCell(bundle, cupsQuery.data ?? [])}</TableCell>
                    <TableCell>{formatLidCell(bundle, lidsQuery.data ?? [])}</TableCell>
                    <TableCell>
                      {bundle.cup_qty_per_set} cup / {bundle.lid_qty_per_set} lid
                    </TableCell>
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
            setSelectedBundleId(null)
            setSubmitError(null)
            form.reset(emptyFormValues)
          }
        }}
      >
        <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedBundle ? "Edit Bundle" : "Create Bundle"}</DialogTitle>
            <DialogDescription>
              Define the commercial line item and its internal cup/lid composition.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              {submitError ? (
                <Alert>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="16oz 95mm PET Cup + Flat Lid" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cup_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cup component</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No cup" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={noneValue}>No cup</SelectItem>
                          {(cupsQuery.data ?? []).map((cup) => (
                            <SelectItem key={cup.id} value={cup.id}>
                              {formatCupLabel(cup)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cup_qty_per_set"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cup qty per set</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={field.value}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="lid_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lid component</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No lid" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={noneValue}>No lid</SelectItem>
                          {(lidsQuery.data ?? []).map((lid) => (
                            <SelectItem key={lid.id} value={lid.id}>
                              {formatLidLabel(lid)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lid_qty_per_set"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lid qty per set</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={field.value}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    </FormControl>
                    <FormLabel className="m-0">Active</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false)
                    setSelectedBundleId(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createProductBundle.isPending || updateProductBundle.isPending}>
                  {selectedBundle ? "Save Bundle" : "Create Bundle"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function toFormValues(bundle: ProductBundle): ProductBundleFormValues {
  return {
    name: bundle.name,
    description: bundle.description ?? "",
    cup_id: bundle.cup_id ?? noneValue,
    lid_id: bundle.lid_id ?? noneValue,
    cup_qty_per_set: bundle.cup_qty_per_set,
    lid_qty_per_set: bundle.lid_qty_per_set,
    is_active: bundle.is_active,
  }
}

function filterAndSortBundles(
  bundles: ProductBundle[],
  search: string,
  cups: Cup[],
  lids: Lid[],
): ProductBundle[] {
  const normalizedSearch = search.trim().toLowerCase()

  return [...bundles]
    .filter((bundle) => {
      if (!normalizedSearch) {
        return true
      }

      return [
        bundle.name,
        bundle.description ?? "",
        bundle.cup_id ? formatCupCell(bundle, cups) : "",
        bundle.lid_id ? formatLidCell(bundle, lids) : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

function formatCupCell(bundle: ProductBundle, cups: Cup[]): string {
  if (!bundle.cup_id) {
    return "No cup"
  }

  const cup = cups.find((entry) => entry.id === bundle.cup_id)
  return cup ? formatCupLabel(cup) : "Cup not found"
}

function formatLidCell(bundle: ProductBundle, lids: Lid[]): string {
  if (!bundle.lid_id) {
    return "No lid"
  }

  const lid = lids.find((entry) => entry.id === bundle.lid_id)
  return lid ? formatLidLabel(lid) : "Lid not found"
}

function formatCupLabel(cup: Cup): string {
  return `${cup.sku} · ${cup.size} ${cup.diameter} ${formatToken(cup.brand)} ${formatToken(cup.color)}`
}

function formatLidLabel(lid: Lid): string {
  return `${lid.sku} · ${lid.diameter} ${formatToken(lid.shape)} ${formatToken(lid.brand)} ${formatToken(lid.color)}`
}

function formatToken(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
