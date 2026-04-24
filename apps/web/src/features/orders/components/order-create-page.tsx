import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, Navigate, useNavigate } from "@tanstack/react-router"
import { GripVertical, TrashIcon } from "lucide-react"
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
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useFormField,
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
import { formatCurrency } from "@workspace/ui/lib/number"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { appPermissions, getDefaultAuthorizedRoute, hasPermission } from "@/features/auth/permissions"
import type { Cup } from "@/features/cups/api/cups-client"
import { useCupsQuery } from "@/features/cups/hooks/use-cups"
import type { Customer } from "@/features/customers/api/customers-client"
import { useCustomersQuery } from "@/features/customers/hooks/use-customers"
import { useInventoryBalancesQuery } from "@/features/inventory/hooks/use-inventory"
import type { Lid } from "@/features/lids/api/lids-client"
import { useLidsQuery } from "@/features/lids/hooks/use-lids"
import type { NonStockItem } from "@/features/non-stock-items/api/non-stock-items-client"
import { useNonStockItemsQuery } from "@/features/non-stock-items/hooks/use-non-stock-items"
import { CreateOrderError } from "@/features/orders/api/orders-client"
import { useCreateOrderMutation } from "@/features/orders/hooks/use-orders"

const orderCreateSchema = z.object({
  customer_id: z.string().uuid({ message: "Select a customer." }),
  notes: z.string().trim().max(1000).optional(),
  line_items: z
    .array(
      z
        .object({
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

type OrderCreateValues = z.infer<typeof orderCreateSchema>

const emptyLineItem: OrderCreateValues["line_items"][number] = {
  item_type: "cup",
  item_id: undefined,
  description_snapshot: "",
  quantity: 1,
  unit_sell_price: undefined,
  unit_cost_price: undefined,
  notes: "",
}

function parseMoneyAmount(value: string | undefined | null): number | null {
  if (!value) {
    return null
  }

  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function resolveCatalogLineItemUnitAmount(
  item:
    | Cup
    | Lid
    | NonStockItem
    | undefined,
): number | null {
  if (!item || !("default_sell_price" in item)) {
    return null
  }

  return parseMoneyAmount(item.default_sell_price)
}


function formatCustomerComboboxLabel(customer: Customer): string {
  return `${customer.business_name} (${customer.contact_person ? `${customer.contact_person}` : ""} ${customer.contact_number ? ` · ${customer.contact_number}` : ""})`
}

function OrderCustomerCombobox({
  value,
  onChange,
  onBlur,
}: {
  value: string
  onChange: (next: string) => void
  onBlur?: () => void
}) {
  const { formItemId, formDescriptionId, formMessageId, error } = useFormField()
  const [open, setOpen] = useState(false)
  /** Drives API search only while the menu is open; avoids treating the selected label (or id) as a filter. */
  const [listSearch, setListSearch] = useState("")
  const deferredListSearch = useDeferredValue(listSearch.trim())
  const [inputValue, setInputValue] = useState("")
  /** Last customer chosen from the list; stabilizes combobox value when `customers` is briefly empty. */
  const [lastPicked, setLastPicked] = useState<Customer | null>(null)
  const customersQuery = useCustomersQuery({
    search: open ? (deferredListSearch || undefined) : undefined,
  })
  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data])
  const valueRef = useRef(value)
  /** After open, ignore one input sync that repeats the selected label so list search stays unfiltered. */
  const skipListSearchSyncRef = useRef(false)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const selectedCustomer =
    value === ""
      ? null
      : (customers.find((c) => c.id === value) ?? (lastPicked?.id === value ? lastPicked : null))

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setListSearch("")
      skipListSearchSyncRef.current = true
    }
  }

  function handleCustomerChange(next: Customer | null) {
    if (!next) {
      valueRef.current = ""
      setLastPicked(null)
      onChange("")
      setInputValue("")
      return
    }
    valueRef.current = next.id
    setLastPicked(next)
    onChange(next.id)
    setInputValue(formatCustomerComboboxLabel(next))
  }

  function handleInputValueChange(next: string) {
    setInputValue(next)
    if (open) {
      if (skipListSearchSyncRef.current) {
        const committed = selectedCustomer
        const committedLabel = committed ? formatCustomerComboboxLabel(committed) : ""
        if (committedLabel !== "" && next === committedLabel) {
          skipListSearchSyncRef.current = false
          return
        }
        skipListSearchSyncRef.current = false
      }
      setListSearch(next)
    }
    const committedId = valueRef.current
    if (!committedId) {
      return
    }
    const expectedLabel = selectedCustomer
      ? formatCustomerComboboxLabel(selectedCustomer)
      : null
    // `selectedCustomer` / expectedLabel can still be the *previous* row for one tick after a new
    // item is chosen; `next` may already be the new row's label. Don't clear if `next` is any
    // customer's canonical label (typical list selection).
    if (expectedLabel !== null && next !== expectedLabel) {
      const nextMatchesListedCustomer = customers.some(
        (c) => formatCustomerComboboxLabel(c) === next,
      )
      if (nextMatchesListedCustomer) {
        return
      }
      valueRef.current = ""
      setLastPicked(null)
      onChange("")
    }
  }

  return (
    <div className="grid gap-2">
      {customersQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{customersQuery.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <Combobox
        open={open}
        onOpenChange={handleOpenChange}
        value={selectedCustomer}
        onValueChange={handleCustomerChange}
        inputValue={inputValue}
        onInputValueChange={handleInputValueChange}
        items={customers}
        filter={null}
        itemToStringLabel={(customer) => formatCustomerComboboxLabel(customer)}
        itemToStringValue={(customer) => customer.id}
        isItemEqualToValue={(a, b) => a.id === b.id}
      >
        <ComboboxInput
          id={formItemId}
          aria-describedby={
            !error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`
          }
          aria-invalid={!!error || undefined}
          onBlur={onBlur}
          placeholder="Search by code, name, contact, email, or phone"
          showClear
          className="w-full min-w-0"
        />
        <ComboboxContent>
          <ComboboxEmpty>
            No active customers found. Create or reactivate a customer before creating an order.
          </ComboboxEmpty>
          <ComboboxList>
            {customersQuery.isLoading ? (
              <div className="px-3 py-2 text-muted-foreground text-sm">Searching customers…</div>
            ) : customers.length === 0 ? null : (
              (customer: Customer) => (
                <ComboboxItem
                  key={customer.id}
                  value={customer}
                  disabled={!customer.is_active}
                >
                  <div className="flex items-center align-middle gap-2">
                    <span className="font-medium">{customer.business_name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({customer.contact_person ? `${customer.contact_person}` : ""} {customer.contact_number ? ` · ${customer.contact_number}` : ""})
                    </span>
                  </div>
                </ComboboxItem>
              )
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
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

function OrderCreateLineItemFields({
  index,
  fieldId,
  activeCups,
  activeLids,
  activeNonStockItems,
  availableQuantityByTrackedItemKey,
  cupsLoading,
  lidsLoading,
  nonStockItemsLoading,
  canManageCustomCharges,
}: {
  index: number
  fieldId: string
  activeCups: Cup[]
  activeLids: Lid[]
  activeNonStockItems: NonStockItem[]
  availableQuantityByTrackedItemKey: Map<string, number>
  cupsLoading: boolean
  lidsLoading: boolean
  nonStockItemsLoading: boolean
  canManageCustomCharges: boolean
}) {
  const { control, setValue, getValues } = useFormContext<OrderCreateValues>()
  const itemType =
    useWatch({
      control,
      name: `line_items.${index}.item_type`,
    }) ?? "cup"
  const quantity =
    useWatch({
      control,
      name: `line_items.${index}.quantity`,
    }) ?? 0
  const itemId = useWatch({
    control,
    name: `line_items.${index}.item_id`,
  })
  const customChargeUnitSellPrice = useWatch({
    control,
    name: `line_items.${index}.unit_sell_price`,
  })
  const availableItems =
    itemType === "cup"
      ? activeCups
      : itemType === "lid"
        ? activeLids
        : activeNonStockItems
  const selectedCatalogItem = availableItems.find((item) => item.id === itemId)
  const selectedAvailableQuantity =
    itemType === "cup" || itemType === "lid"
      ? availableQuantityByTrackedItemKey.get(toTrackedItemKey(itemType, itemId))
      : undefined
  const unitAmount =
    itemType === "custom_charge"
      ? customChargeUnitSellPrice ?? null
      : resolveCatalogLineItemUnitAmount(selectedCatalogItem)
  const lineTotal = unitAmount !== null ? quantity * unitAmount : null

  useEffect(() => {
    if (itemType === "custom_charge") {
      return
    }

    const currentId = getValues(`line_items.${index}.item_id`)
    if (currentId && !availableItems.some((item) => item.id === currentId)) {
      setValue(`line_items.${index}.item_id`, undefined, { shouldValidate: true })
    }
  }, [availableItems, getValues, index, itemType, setValue])

  return (
    <div className="grid w-full min-w-0 gap-3">
      <FormField
        control={control}
        name={`line_items.${index}.item_type`}
        render={({ field: itemTypeField }) => (
          <FormItem>
            <FormLabel>Item type</FormLabel>
            <Select
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
                  <Input {...field} value={field.value ?? ""} placeholder="Rush fee, correction fee, labor charge" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`line_items.${index}.quantity`}
            render={({ field: quantityField }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input.Number
                    min={1}
                    value={quantityField.value}
                    onChange={(value) => quantityField.onChange(value ?? 0)}
                  />
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
                  <Input.Currency
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0.00"
                  />
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
                  <Input.Currency
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0.00"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`line_items.${index}.notes`}
            render={({ field: notesField }) => (
              <FormItem>
                <FormLabel>Line note</FormLabel>
                <FormControl>
                  <Input {...notesField} value={notesField.value ?? ""} />
                </FormControl>
              </FormItem>
            )}
          />

          {lineTotal !== null ? (
            <div className="md:col-span-2">
              <p className="text-muted-foreground text-sm">
                Line total: <span className="font-medium text-foreground">{formatCurrency(lineTotal)}</span>
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[36%_15%_10%_37%]">
          <FormField
            control={control}
            name={`line_items.${index}.item_id`}
            render={({ field: itemIdField }) => (
              <FormItem>
                <FormLabel>
                  {itemType === "cup"
                    ? "Cup SKU"
                    : itemType === "lid"
                      ? "Lid"
                      : "General Item"}
                </FormLabel>
                <Select
                  key={`${fieldId}-${itemType}`}
                  value={resolveSelectableItemId(itemIdField.value, availableItems)}
                  onValueChange={itemIdField.onChange}
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
                          ? formatCupOption(
                              item as Cup,
                              availableQuantityByTrackedItemKey.get(toTrackedItemKey("cup", item.id)),
                            )
                          : itemType === "lid"
                            ? formatLidOption(
                                item as Lid,
                                availableQuantityByTrackedItemKey.get(toTrackedItemKey("lid", item.id)),
                              )
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
            render={({ field: quantityField }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input.Number
                    min={1}
                    value={quantityField.value}
                    onChange={(value) => quantityField.onChange(value ?? 0)}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`line_items.${index}.notes`}
            render={({ field: notesField }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Line note</FormLabel>
                <FormControl>
                  <Input {...notesField} value={notesField.value ?? ""} />
                </FormControl>
              </FormItem>
            )}
          />

          {lineTotal !== null || selectedAvailableQuantity !== undefined ? (
            <div className="md:col-span-4">
              <p className="text-muted-foreground text-sm">
                {lineTotal !== null ? (
                  <>
                    Line total:{" "}
                    <span className="font-medium text-foreground">{formatCurrency(lineTotal)}</span>
                  </>
                ) : null}
                {selectedAvailableQuantity !== undefined ? (
                  <span className={lineTotal !== null ? "ml-3" : undefined}>
                    Available stock:{" "}
                    <span className={selectedAvailableQuantity < quantity ? "font-medium text-destructive" : "font-medium text-foreground"}>
                      {selectedAvailableQuantity.toLocaleString()}
                    </span>
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function OrderCreatePage() {
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const canManageOrders = hasPermission(currentUser.data, appPermissions.ordersManage)
  const cupsQuery = useCupsQuery()
  const lidsQuery = useLidsQuery()
  const nonStockItemsQuery = useNonStockItemsQuery()
  const inventoryBalancesQuery = useInventoryBalancesQuery()
  const createOrderMutation = useCreateOrderMutation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const canManageCustomCharges = hasPermission(
    currentUser.data,
    appPermissions.ordersCustomChargesManage,
  )
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
  const availableQuantityByTrackedItemKey = useMemo(() => {
    const quantities = new Map<string, number>()

    for (const balance of inventoryBalancesQuery.data ?? []) {
      if (balance.item_type === "cup") {
        quantities.set(toTrackedItemKey("cup", balance.cup.id), balance.available)
        continue
      }

      quantities.set(toTrackedItemKey("lid", balance.lid.id), balance.available)
    }

    return quantities
  }, [inventoryBalancesQuery.data])

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canManageOrders) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/orders/new") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Order creation requires order-management permission.</AlertDescription>
      </Alert>
    )
  }

  const form = useForm<OrderCreateValues>({
    resolver: zodResolver(orderCreateSchema),
    defaultValues: {
      customer_id: "",
      notes: "",
      line_items: [emptyLineItem],
    },
  })

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "line_items",
  })
  const systemNotes = buildOrderCreationSystemNotes(
    form.watch("line_items"),
    activeCups,
    activeLids,
    availableQuantityByTrackedItemKey,
  )

  function handleDragEnd(result: DropResult) {
    const { source, destination } = result

    if (!destination || destination.index === source.index) {
      return
    }

    move(source.index, destination.index)
  }

  async function onSubmit(values: OrderCreateValues) {
    setSubmitError(null)
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
      await createOrderMutation.mutateAsync({
        customer_id: values.customer_id,
        notes: values.notes?.trim() || undefined,
        line_items: values.line_items.map((item) =>
          item.item_type === "cup"
                ? {
                    item_type: "cup",
                    cup_id: item.item_id!,
                    quantity: item.quantity,
                    notes: item.notes?.trim() || undefined,
                  }
                : item.item_type === "lid"
                  ? {
                    item_type: "lid",
                    lid_id: item.item_id!,
                    quantity: item.quantity,
                    notes: item.notes?.trim() || undefined,
                  }
              : item.item_type === "non_stock_item"
                ? {
                  item_type: "non_stock_item",
                  non_stock_item_id: item.item_id!,
                  quantity: item.quantity,
                  notes: item.notes?.trim() || undefined,
                }
                : {
                  item_type: "custom_charge",
                  description_snapshot: item.description_snapshot!.trim(),
                  quantity: item.quantity,
                  unit_sell_price: item.unit_sell_price!.toFixed(2),
                  unit_cost_price:
                    item.unit_cost_price === undefined ? undefined : item.unit_cost_price.toFixed(2),
                  notes: item.notes?.trim() || undefined,
                },
        ),
      })

      await navigate({ to: "/orders" })
    } catch (error) {
      if (error instanceof CreateOrderError) {
        for (const lineItemError of error.lineItems) {
          form.setError(
            `line_items.${lineItemError.line_item_index}.${lineItemError.field}` as FieldPath<OrderCreateValues>,
            {
              type: "server",
              message: lineItemError.message,
            },
          )
        }
      }

      setSubmitError(error instanceof Error ? error.message : "Unable to create order.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid min-w-0 gap-1">
            <CardTitle>Create Pending Order</CardTitle>
          </div>
          <Button asChild variant="outline" className="w-full shrink-0 sm:w-auto">
            <Link to="/orders">Back to orders</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {submitError ? (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <OrderCustomerCombobox
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                  
                </FormItem>
              )}
            />

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <FormLabel>Line items</FormLabel>
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="order-line-items">
                  {(droppableProvided) => (
                    <div
                      ref={droppableProvided.innerRef}
                      {...droppableProvided.droppableProps}
                      className="grid gap-3"
                    >
                      {fields.map((field, index) => (
                        <Draggable key={field.id} draggableId={field.id} index={index}>
                          {(draggableProvided, draggableSnapshot) => (
                            <div
                              ref={draggableProvided.innerRef}
                              {...draggableProvided.draggableProps}
                              className={`grid gap-3 border p-3 ${
                                draggableSnapshot.isDragging
                                  ? "bg-background shadow-sm ring-1 ring-border"
                                  : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3 border-b pb-3">
                                <div className="flex items-center gap-3">
                                  <Button
                                    type="button"
                                    aria-label={`Reorder line item ${index + 1}`}
                                    variant="outline"
                                    size="icon-xs"
                                    {...draggableProvided.dragHandleProps}
                                  >
                                    <GripVertical className="h-2 w-2 p-0" />
                                  </Button>
                                  <div className="grid gap-1">
                                    <p className="font-medium text-sm">Line item {index + 1}</p>
                                  </div>
                                </div>

                                {fields.length > 1 ? (
                                  <Button
                                    type="button"
                                    size="icon-xs"
                                    variant="destructive"
                                    onClick={() => remove(index)}
                                  >
                                    <TrashIcon className="h-2 w-2 p-0" />
                                  </Button>
                                ) : null}
                              </div>

                              <OrderCreateLineItemFields
                                index={index}
                                fieldId={field.id}
                                activeCups={activeCups}
                                activeLids={activeLids}
                                activeNonStockItems={activeNonStockItems}
                                availableQuantityByTrackedItemKey={availableQuantityByTrackedItemKey}
                                cupsLoading={cupsQuery.isLoading}
                                lidsLoading={lidsQuery.isLoading}
                                nonStockItemsLoading={nonStockItemsQuery.isLoading}
                                canManageCustomCharges={canManageCustomCharges}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {droppableProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {form.formState.errors.line_items?.message ? (
                <p className="text-destructive text-sm">
                  {form.formState.errors.line_items.message}
                </p>
              ) : null}
              <Button
                  type="button"
                  variant="ghost"
                  className="bg-orange-300 w-max-auto"
                  size="sm"
                  onClick={() => append({ ...emptyLineItem })}
                >
                  Add item
                </Button>
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
                      value={field.value ?? ""}
                      placeholder="Optional order note"
                    />
                  </FormControl>
                  
                </FormItem>
              )}
            />

            {systemNotes.length > 0 ? (
              <Alert>
                <AlertDescription>
                  <div className="grid gap-2">
                    <p>
                      System note: this order will reserve more stock than is currently available.
                      Creation is allowed so purchasing can catch up with committed orders.
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      {systemNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              disabled={
                createOrderMutation.isPending ||
                cupsQuery.isLoading ||
                lidsQuery.isLoading ||
                inventoryBalancesQuery.isLoading
              }
            >
              {createOrderMutation.isPending ? "Creating order..." : "Create pending order"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function toTrackedItemKey(itemType: "cup" | "lid", itemId: string | undefined): string {
  return `${itemType}:${itemId ?? ""}`
}

function formatAvailableQuantity(availableQuantity: number | undefined): string {
  return availableQuantity === undefined
    ? "Available: not loaded"
    : `Available: ${availableQuantity.toLocaleString()}`
}

function formatCupOption(cup: Cup, availableQuantity?: number): string {
  return `${cup.sku} · ${cup.type} · ${cup.brand} · ${cup.size} · ${cup.diameter} · ${formatAvailableQuantity(availableQuantity)}`
}

function formatLidOption(lid: Lid, availableQuantity?: number): string {
  const skuPart = lid.sku.trim() ? `${lid.sku.trim()} · ` : ""
  return `${skuPart}${lid.type} · ${lid.brand} · ${lid.diameter} · ${lid.shape} · ${lid.color} · ${formatAvailableQuantity(availableQuantity)}`
}

function formatNonStockItemOption(item: NonStockItem): string {
  return item.description?.trim() ? `${item.name} · ${item.description}` : item.name
}

function buildOrderCreationSystemNotes(
  lineItems: OrderCreateValues["line_items"],
  activeCups: Cup[],
  activeLids: Lid[],
  availableQuantityByTrackedItemKey: Map<string, number>,
): string[] {
  return lineItems.flatMap((item, index) => {
    if (item.item_type !== "cup" && item.item_type !== "lid") {
      return []
    }

    if (!item.item_id || !Number.isFinite(item.quantity)) {
      return []
    }

    const availableQuantity = availableQuantityByTrackedItemKey.get(
      toTrackedItemKey(item.item_type, item.item_id),
    )

    if (availableQuantity === undefined || availableQuantity >= item.quantity) {
      return []
    }

    const label =
      item.item_type === "cup"
        ? formatCupShortLabel(activeCups.find((cup) => cup.id === item.item_id))
        : formatLidShortLabel(activeLids.find((lid) => lid.id === item.item_id))

    const shortage = item.quantity - availableQuantity

    return [
      `Line item ${index + 1}: ${label} has ${availableQuantity.toLocaleString()} available, quantity is ${item.quantity.toLocaleString()}, shortage is ${shortage.toLocaleString()}.`,
    ]
  })
}

function formatCupShortLabel(cup: Cup | undefined): string {
  return cup ? `cup ${cup.sku}` : "selected cup"
}

function formatLidShortLabel(lid: Lid | undefined): string {
  if (!lid) {
    return "selected lid"
  }

  if (lid.sku.trim()) {
    return `lid ${lid.sku.trim()}`
  }

  return `lid ${lid.brand} ${lid.diameter} ${lid.shape} ${lid.color}`
}
