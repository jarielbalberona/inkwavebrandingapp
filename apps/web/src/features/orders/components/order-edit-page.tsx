import { useEffect, useMemo, useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Link, Navigate, useNavigate } from "@tanstack/react-router"
import { TrashIcon } from "lucide-react"
import {
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
  type FieldPath,
} from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { appPermissions, getDefaultAuthorizedRoute, hasPermission } from "@/features/auth/permissions"
import type { Cup } from "@/features/cups/api/cups-client"
import { useCupsQuery } from "@/features/cups/hooks/use-cups"
import { CustomerSearchSelect } from "@/features/customers/components/customer-search-select"
import type { Lid } from "@/features/lids/api/lids-client"
import { useLidsQuery } from "@/features/lids/hooks/use-lids"
import type { NonStockItem } from "@/features/non-stock-items/api/non-stock-items-client"
import { useNonStockItemsQuery } from "@/features/non-stock-items/hooks/use-non-stock-items"
import { CreateOrderError } from "@/features/orders/api/orders-client"
import {
  useOrderInvoiceQuery,
  useOrderQuery,
  useUpdateOrderMutation,
} from "@/features/orders/hooks/use-orders"

const orderEditSchema = z.object({
  customer_id: z.string().uuid({ message: "Select a customer." }),
  notes: z.string().trim().max(1000).optional(),
  line_items: z
    .array(
      z
        .object({
          id: z.string().uuid().optional(),
          item_type: z.enum(["cup", "lid", "non_stock_item", "custom_charge"]),
          item_id: z.string().uuid().optional(),
          description_snapshot: z.string().trim().max(500).optional(),
          quantity: z.number().int().positive("Quantity must be a positive whole number."),
          unit_sell_price: z.number().nonnegative().optional(),
          unit_cost_price: z.number().nonnegative().optional(),
          notes: z.string().trim().max(500).optional(),
        })
        .superRefine((value, context) => {
          if (value.item_type === "custom_charge") {
            if (!value.description_snapshot?.trim()) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["description_snapshot"],
                message: "Enter a custom charge description.",
              })
            }

            if (value.unit_sell_price === undefined) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["unit_sell_price"],
                message: "Enter a unit sell price.",
              })
            }

            return
          }

          if (!value.item_id) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["item_id"],
              message: "Select a source item.",
            })
          }
        }),
    )
    .min(1, "Add at least one line item."),
})

type OrderEditValues = z.infer<typeof orderEditSchema>

const emptyLineItem: OrderEditValues["line_items"][number] = {
  item_type: "cup",
  item_id: undefined,
  description_snapshot: "",
  quantity: 1,
  unit_sell_price: undefined,
  unit_cost_price: undefined,
  notes: "",
}

export function OrderEditPage({ orderId }: { orderId: string }) {
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const canManageOrders = hasPermission(currentUser.data, appPermissions.ordersManage)
  const canManageCustomCharges = hasPermission(
    currentUser.data,
    appPermissions.ordersCustomChargesManage,
  )
  const canViewInvoices = hasPermission(currentUser.data, appPermissions.invoicesView)
  const canManageInvoices = hasPermission(currentUser.data, appPermissions.invoicesManage)
  const orderQuery = useOrderQuery(orderId)
  const orderInvoiceQuery = useOrderInvoiceQuery(orderId, canViewInvoices)
  const cupsQuery = useCupsQuery()
  const lidsQuery = useLidsQuery()
  const nonStockItemsQuery = useNonStockItemsQuery()
  const updateOrderMutation = useUpdateOrderMutation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const activeCups = useMemo(
    () => (cupsQuery.data ?? []).filter((cup) => cup.is_active),
    [cupsQuery.data],
  )
  const activeLids = useMemo(
    () => (lidsQuery.data ?? []).filter((lid) => lid.is_active),
    [lidsQuery.data],
  )
  const activeNonStockItems = useMemo(
    () => (nonStockItemsQuery.data ?? []).filter((item) => item.is_active),
    [nonStockItemsQuery.data],
  )

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canManageOrders) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== `/orders/${orderId}/edit`) {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Order editing requires order-management permission.</AlertDescription>
      </Alert>
    )
  }

  const form = useForm<OrderEditValues>({
    resolver: zodResolver(orderEditSchema),
    defaultValues: {
      customer_id: "",
      notes: "",
      line_items: [emptyLineItem],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items",
  })

  const order = orderQuery.data ?? null
  const invoice = orderInvoiceQuery.data ?? null
  const invoiceLocked = invoice?.status === "paid" || invoice?.status === "void"
  const statusLocked =
    order?.status === "canceled" || order?.status === "completed" || order?.status === "partial_released"
  const nonAdminCustomChargeLock =
    !canManageCustomCharges && Boolean(order?.items.some((item) => item.item_type === "custom_charge"))
  const formLocked = statusLocked || invoiceLocked || nonAdminCustomChargeLock

  useEffect(() => {
    if (!order) {
      return
    }

    form.reset({
      customer_id: order.customer.id,
      notes: order.notes ?? "",
      line_items: order.items.map((item) => ({
        id: item.id,
        item_type: item.item_type,
        item_id:
          item.item_type === "cup"
            ? item.cup.id
            : item.item_type === "lid"
              ? item.lid.id
              : item.item_type === "non_stock_item"
                ? item.non_stock_item.id
                : undefined,
        description_snapshot:
          item.item_type === "custom_charge" ? item.custom_charge.description_snapshot : "",
        quantity: item.quantity,
        unit_sell_price: item.unit_sell_price ? Number(item.unit_sell_price) : undefined,
        unit_cost_price: item.unit_cost_price ? Number(item.unit_cost_price) : undefined,
        notes: item.notes ?? "",
      })),
    })
  }, [form, order])

  async function onSubmit(values: OrderEditValues) {
    if (!order) {
      return
    }

    setSubmitError(null)
    setSubmitSuccess(null)
    form.clearErrors()

    const uniqueKeys = values.line_items
      .filter((item) => item.item_type !== "custom_charge" && item.item_id)
      .map((item) => `${item.item_type}:${item.item_id}`)

    if (new Set(uniqueKeys).size !== uniqueKeys.length) {
      const duplicateIndexesByKey = new Map<string, number[]>()

      uniqueKeys.forEach((key, index) => {
        const indexes = duplicateIndexesByKey.get(key) ?? []
        indexes.push(index)
        duplicateIndexesByKey.set(key, indexes)
      })

      for (const indexes of duplicateIndexesByKey.values()) {
        if (indexes.length < 2) {
          continue
        }

        for (const lineItemIndex of indexes) {
          form.setError(`line_items.${lineItemIndex}.item_id`, {
            type: "manual",
            message: `Line item ${lineItemIndex + 1} duplicates another selected item.`,
          })
        }
      }

      setSubmitError("Duplicate source items found in order line items.")
      return
    }

    try {
      const updatedOrder = await updateOrderMutation.mutateAsync({
        id: orderId,
        payload: {
          customer_id: values.customer_id !== order.customer.id ? values.customer_id : undefined,
          notes:
            (values.notes?.trim() || null) !== (order.notes ?? null)
              ? values.notes?.trim() || null
              : undefined,
          line_items: values.line_items.map((item) =>
            item.item_type === "cup"
              ? {
                  id: item.id,
                  item_type: "cup" as const,
                  cup_id: item.item_id!,
                  quantity: item.quantity,
                  notes: item.notes?.trim() || undefined,
                }
              : item.item_type === "lid"
                ? {
                    id: item.id,
                    item_type: "lid" as const,
                    lid_id: item.item_id!,
                    quantity: item.quantity,
                    notes: item.notes?.trim() || undefined,
                  }
                : item.item_type === "non_stock_item"
                  ? {
                      id: item.id,
                      item_type: "non_stock_item" as const,
                      non_stock_item_id: item.item_id!,
                      quantity: item.quantity,
                      notes: item.notes?.trim() || undefined,
                    }
                  : {
                      id: item.id,
                      item_type: "custom_charge" as const,
                      description_snapshot: item.description_snapshot!.trim(),
                      quantity: item.quantity,
                      unit_sell_price: item.unit_sell_price!.toFixed(2),
                      unit_cost_price:
                        item.unit_cost_price === undefined
                          ? undefined
                          : item.unit_cost_price.toFixed(2),
                      notes: item.notes?.trim() || undefined,
                    },
          ),
        },
      })

      setSubmitSuccess(`Updated ${updatedOrder.order_number}.`)
      await navigate({ to: "/orders/$orderId", params: { orderId } })
    } catch (error) {
      if (error instanceof CreateOrderError) {
        for (const lineItemError of error.lineItems) {
          form.setError(
            `line_items.${lineItemError.line_item_index}.${lineItemError.field}` as FieldPath<OrderEditValues>,
            {
              type: "server",
              message: lineItemError.message,
            },
          )
        }
      }

      setSubmitError(error instanceof Error ? error.message : "Unable to update order.")
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle>Edit Order</CardTitle>
            <CardDescription>
              Structural order changes stay on the order while the invoice is unpaid. Paid or voided invoices lock this form.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link to="/orders/$orderId" params={{ orderId }}>
              Back to order
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {orderQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading order...</p>
        ) : null}

        {orderQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{orderQuery.error.message}</AlertDescription>
          </Alert>
        ) : null}

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

        {order ? (
          <>
            <div className="grid gap-2 border p-4 text-sm">
              <p className="font-medium">{order.order_number}</p>
              <p className="text-muted-foreground">Order status: {order.status}</p>
              {canManageInvoices && invoice ? (
                <p className="text-muted-foreground">Invoice status: {invoice.status}</p>
              ) : null}
              {formLocked ? (
                <p className="text-destructive">
                  {invoice?.status === "paid"
                    ? "This order is structurally locked because the invoice has been paid."
                    : invoice?.status === "void"
                      ? "This order is structurally locked because the invoice has been voided."
                      : nonAdminCustomChargeLock
                        ? "Only users with custom-charge permission can edit orders that contain custom charge lines."
                        : "This order is no longer in the unpaid open-edit window."}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Add, edit, or remove line items here. The linked unpaid invoice will be resynced from this order.
                </p>
              )}
            </div>

            <Form {...form}>
              <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      {formLocked ? (
                        <div className="rounded-md border p-3 text-sm">
                          {order.customer.business_name}
                        </div>
                      ) : (
                        <FormControl>
                          <CustomerSearchSelect
                            includeInactive
                            selectedCustomerId={field.value || null}
                            onSelect={(customer) => field.onChange(customer.id)}
                          />
                        </FormControl>
                      )}
                    </FormItem>
                  )}
                />

                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <FormLabel>Line items</FormLabel>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={formLocked}
                      onClick={() => append({ ...emptyLineItem })}
                    >
                      Add item
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="grid gap-3 border p-3">
                        <div className="flex items-start justify-between gap-3 border-b pb-3">
                          <div className="grid gap-1">
                            <p className="font-medium text-sm">Line item {index + 1}</p>
                          </div>
                          {fields.length > 1 ? (
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="destructive"
                              disabled={formLocked}
                              onClick={() => remove(index)}
                            >
                              <TrashIcon className="h-2 w-2 p-0" />
                            </Button>
                          ) : null}
                        </div>

                        <OrderEditLineItemFields
                          index={index}
                          fieldId={field.id}
                          activeCups={activeCups}
                          activeLids={activeLids}
                          activeNonStockItems={activeNonStockItems}
                          cupsLoading={cupsQuery.isLoading}
                          lidsLoading={lidsQuery.isLoading}
                          nonStockItemsLoading={nonStockItemsQuery.isLoading}
                          disabled={formLocked}
                                canManageCustomCharges={canManageCustomCharges}
                        />
                      </div>
                    ))}
                  </div>

                  {form.formState.errors.line_items?.message ? (
                    <p className="text-destructive text-sm">
                      {form.formState.errors.line_items.message}
                    </p>
                  ) : null}
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          disabled={formLocked}
                          value={field.value ?? ""}
                          placeholder="Optional order note"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={
                    formLocked ||
                    updateOrderMutation.isPending ||
                    cupsQuery.isLoading ||
                    lidsQuery.isLoading ||
                    nonStockItemsQuery.isLoading
                  }
                >
                  {updateOrderMutation.isPending ? "Saving order..." : "Save order changes"}
                </Button>
              </form>
            </Form>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function OrderEditLineItemFields({
  index,
  fieldId,
  activeCups,
  activeLids,
  activeNonStockItems,
  cupsLoading,
  lidsLoading,
  nonStockItemsLoading,
  disabled,
  canManageCustomCharges,
}: {
  index: number
  fieldId: string
  activeCups: Cup[]
  activeLids: Lid[]
  activeNonStockItems: NonStockItem[]
  cupsLoading: boolean
  lidsLoading: boolean
  nonStockItemsLoading: boolean
  disabled: boolean
  canManageCustomCharges: boolean
}) {
  const { control, setValue } = useFormContext<OrderEditValues>()
  const itemType =
    useWatch({
      control,
      name: `line_items.${index}.item_type`,
    }) ?? "cup"
  const availableItems =
    itemType === "cup"
      ? activeCups
      : itemType === "lid"
        ? activeLids
        : activeNonStockItems

  return (
    <div className="grid gap-3">
      <FormField
        control={control}
        name={`line_items.${index}.item_type`}
        render={({ field: itemTypeField }) => (
          <FormItem>
            <FormLabel>Item type</FormLabel>
            <Select
              disabled={disabled}
              value={itemTypeField.value}
              onValueChange={(value) => {
                itemTypeField.onChange(value)
                setValue(`line_items.${index}.item_id`, undefined, { shouldValidate: true })
                setValue(`line_items.${index}.description_snapshot`, "", { shouldValidate: false })
                setValue(`line_items.${index}.unit_sell_price`, undefined, { shouldValidate: false })
                setValue(`line_items.${index}.unit_cost_price`, undefined, { shouldValidate: false })
              }}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="cup">Cup</SelectItem>
                <SelectItem value="lid">Lid</SelectItem>
                <SelectItem value="non_stock_item">General Item</SelectItem>
                <SelectItem value="custom_charge" disabled={!canManageCustomCharges}>
                  Custom Charge
                </SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      {itemType === "custom_charge" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={control}
            name={`line_items.${index}.description_snapshot`}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input {...field} disabled={disabled} value={field.value ?? ""} placeholder="Rush fee, correction fee, labor charge" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`line_items.${index}.quantity`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input.Number disabled={disabled} min={1} value={field.value} onChange={(value) => field.onChange(value ?? 0)} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`line_items.${index}.unit_sell_price`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit sell price</FormLabel>
                <FormControl>
                  <Input.Currency disabled={disabled} value={field.value} onChange={field.onChange} placeholder="0.00" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`line_items.${index}.unit_cost_price`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit cost price</FormLabel>
                <FormControl>
                  <Input.Currency disabled={disabled} value={field.value} onChange={field.onChange} placeholder="0.00" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`line_items.${index}.notes`}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Line note</FormLabel>
                <FormControl>
                  <Input {...field} disabled={disabled} value={field.value ?? ""} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[40%_20%_40%]">
          <FormField
            control={control}
            name={`line_items.${index}.item_id`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {itemType === "cup"
                    ? "Cup SKU"
                    : itemType === "lid"
                      ? "Lid"
                      : "General Item"}
                </FormLabel>
                <Select
                  disabled={disabled}
                  key={`${fieldId}-${itemType}`}
                  value={resolveSelectableItemId(field.value, availableItems)}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          itemType === "cup"
                            ? cupsLoading
                              ? "Loading cups..."
                              : "Select cup"
                            : itemType === "lid"
                              ? lidsLoading
                                ? "Loading lids..."
                                : "Select lid"
                              : nonStockItemsLoading
                                ? "Loading general items..."
                                : "Select general item"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {itemType === "cup"
                          ? formatCupOption(item as Cup)
                          : itemType === "lid"
                            ? formatLidOption(item as Lid)
                            : formatNonStockItemOption(item as NonStockItem)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`line_items.${index}.quantity`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input.Number disabled={disabled} min={1} value={field.value} onChange={(value) => field.onChange(value ?? 0)} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`line_items.${index}.notes`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Line note</FormLabel>
                <FormControl>
                  <Input {...field} disabled={disabled} value={field.value ?? ""} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  )
}

function resolveSelectableItemId(
  raw: string | undefined,
  items: readonly { id: string }[],
): string | undefined {
  if (!raw) {
    return undefined
  }

  return items.some((item) => item.id === raw) ? raw : undefined
}

function formatCupOption(cup: Cup): string {
  return `${cup.sku} · ${cup.type} · ${cup.brand} · ${cup.size} · ${cup.diameter}`
}

function formatLidOption(lid: Lid): string {
  const skuPart = lid.sku.trim() ? `${lid.sku.trim()} · ` : ""
  return `${skuPart}${lid.type} · ${lid.brand} · ${lid.diameter} · ${lid.shape} · ${lid.color}`
}

function formatNonStockItemOption(item: NonStockItem): string {
  return item.description?.trim() ? `${item.name} · ${item.description}` : item.name
}
