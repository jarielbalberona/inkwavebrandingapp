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
import type {
  NonStockItem,
  NonStockItemPayload,
} from "@/features/non-stock-items/api/non-stock-items-client"
import {
  useCreateNonStockItemMutation,
  useNonStockItemsQuery,
  useUpdateNonStockItemMutation,
} from "@/features/non-stock-items/hooks/use-non-stock-items"

const generalItemFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z.string().trim().max(1000).optional(),
  has_cost_price: z.boolean(),
  cost_price: z.number().nonnegative(),
  default_sell_price: z.number({
    required_error: "Default sell price is required.",
    invalid_type_error: "Default sell price is required.",
  }).nonnegative(),
  is_active: z.boolean(),
})

type GeneralItemFormValues = z.infer<typeof generalItemFormSchema>

const emptyFormValues: DefaultValues<GeneralItemFormValues> = {
  name: "",
  description: "",
  has_cost_price: false,
  cost_price: 0,
  is_active: true,
}

export function GeneralItemsPage() {
  const currentUser = useCurrentUser()
  const nonStockItemsQuery = useNonStockItemsQuery()
  const createNonStockItem = useCreateNonStockItemMutation()
  const updateNonStockItem = useUpdateNonStockItemMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const canViewGeneralItems = hasPermission(currentUser.data, appPermissions.nonStockItemsView)
  const canManageGeneralItems = hasPermission(currentUser.data, appPermissions.nonStockItemsManage)
  const selectedItem = useMemo(
    () => nonStockItemsQuery.data?.find((item) => item.id === selectedItemId) ?? null,
    [nonStockItemsQuery.data, selectedItemId],
  )
  const visibleItems = useMemo(
    () => filterAndSortGeneralItems(nonStockItemsQuery.data ?? [], search),
    [nonStockItemsQuery.data, search],
  )

  const form = useForm<GeneralItemFormValues>({
    resolver: zodResolver(generalItemFormSchema),
    defaultValues: emptyFormValues,
  })

  const hasCostPrice = useWatch({ control: form.control, name: "has_cost_price" })

  useEffect(() => {
    if (!dialogOpen) {
      return
    }

    form.reset(selectedItem ? toFormValues(selectedItem) : emptyFormValues)
  }, [dialogOpen, form, selectedItem])

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canViewGeneralItems) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/products" && fallbackRoute !== "/general-items") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>General-item visibility requires general-item-view permission.</AlertDescription>
      </Alert>
    )
  }

  async function onSubmit(values: GeneralItemFormValues) {
    setSubmitError(null)

    const payload: NonStockItemPayload = {
      name: values.name.trim(),
      description: values.description?.trim() ? values.description.trim() : null,
      cost_price: values.has_cost_price ? values.cost_price.toFixed(2) : null,
      default_sell_price: values.default_sell_price.toFixed(2),
      is_active: values.is_active,
    }

    try {
      if (selectedItem) {
        await updateNonStockItem.mutateAsync({ id: selectedItem.id, payload })
      } else {
        await createNonStockItem.mutateAsync(payload)
      }

      setDialogOpen(false)
      setSelectedItemId(null)
      form.reset(emptyFormValues)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save general item.")
    }
  }

  function openCreateDialog() {
    setSelectedItemId(null)
    setDialogOpen(true)
  }

  function openDetailDialog(item: NonStockItem) {
    setSelectedItemId(item.id)
    setDialogOpen(true)
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <CardTitle>General Items</CardTitle>
            <CardDescription>
              Managed chargeable master data for non-inventory items such as molds, fees, and setup work.
            </CardDescription>
          </div>
          {canManageGeneralItems ? <Button onClick={openCreateDialog}>Create General Item</Button> : null}
        </CardHeader>
        <CardContent className="grid gap-4">
          {nonStockItemsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading general items...</p>
          ) : null}

          {!nonStockItemsQuery.isLoading && nonStockItemsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No general items found. Admins can create the first general item record.
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="general-item-search">Search general items</Label>
            <Input
              id="general-item-search"
              placeholder="Search name or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {!nonStockItemsQuery.isLoading &&
          nonStockItemsQuery.data &&
          nonStockItemsQuery.data.length > 0 &&
          visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No general items match the current search.</p>
          ) : null}

          {visibleItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  {hasPricing(nonStockItemsQuery.data) ? <TableHead>Cost price</TableHead> : null}
                  {hasPricing(nonStockItemsQuery.data) ? <TableHead>Sell price</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((item) => (
                  <TableRow key={item.id} className={canManageGeneralItems ? "cursor-pointer" : undefined} onClick={() => {
                    if (canManageGeneralItems) {
                      openDetailDialog(item)
                    }
                  }}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.description?.trim() || "No description"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {hasPricing(nonStockItemsQuery.data) ? (
                      <TableCell>
                        {"cost_price" in item ? item.cost_price ?? "No cost" : "Restricted"}
                      </TableCell>
                    ) : null}
                    {hasPricing(nonStockItemsQuery.data) ? (
                      <TableCell>
                        {"default_sell_price" in item ? item.default_sell_price : "Restricted"}
                      </TableCell>
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
            setSelectedItemId(null)
            setSubmitError(null)
            form.reset(emptyFormValues)
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedItem ? "Edit General Item" : "Create General Item"}</DialogTitle>
            <DialogDescription>
              General items are maintained master data. They can be selected in orders but do not participate in inventory or fulfillment.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              {submitError ? (
                <Alert variant="destructive">
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
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
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
                      <Textarea {...field} value={field.value ?? ""} rows={4} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="has_cost_price"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 space-y-0 border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                    </FormControl>
                    <div className="grid gap-1">
                      <FormLabel>Track cost price</FormLabel>
                      <FormDescription>
                        Leave this off if the item is billable but internal cost is unknown or not worth tracking yet.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {hasCostPrice ? (
                <FormField
                  control={form.control}
                  name="cost_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost price</FormLabel>
                      <FormControl>
                        <Input.Currency
                          value={field.value}
                          onChange={(value) => field.onChange(value ?? 0)}
                          placeholder="0.00"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ) : null}

              <FormField
                control={form.control}
                name="default_sell_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default sell price</FormLabel>
                    <FormControl>
                      <Input.Currency
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                        placeholder="0.00"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 space-y-0 border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                    </FormControl>
                    <div className="grid gap-1">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Inactive general items remain visible historically but should not be used for new order entry.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createNonStockItem.isPending || updateNonStockItem.isPending}
                >
                  {selectedItem
                    ? updateNonStockItem.isPending
                      ? "Saving General Item..."
                      : "Save General Item"
                    : createNonStockItem.isPending
                      ? "Creating General Item..."
                      : "Create General Item"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function toFormValues(item: NonStockItem): GeneralItemFormValues {
  return {
    name: item.name,
    description: item.description ?? "",
    has_cost_price: "cost_price" in item && item.cost_price !== null,
    cost_price: "cost_price" in item && item.cost_price ? Number(item.cost_price) : 0,
    default_sell_price:
      "default_sell_price" in item && item.default_sell_price ? Number(item.default_sell_price) : 0,
    is_active: item.is_active,
  }
}

function filterAndSortGeneralItems(items: NonStockItem[], search: string): NonStockItem[] {
  const normalizedSearch = search.trim().toLowerCase()

  return [...items]
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
    .filter((item) => {
      if (!normalizedSearch) {
        return true
      }

      return [item.name, item.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    })
}

function hasPricing(items: NonStockItem[] | undefined) {
  return items?.some((item) => "default_sell_price" in item) ?? false
}
