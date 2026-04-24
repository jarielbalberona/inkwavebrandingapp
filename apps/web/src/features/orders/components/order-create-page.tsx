import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate } from "@tanstack/react-router"
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

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import type { Cup } from "@/features/cups/api/cups-client"
import { useCupsQuery } from "@/features/cups/hooks/use-cups"
import type { Customer } from "@/features/customers/api/customers-client"
import { useCustomersQuery } from "@/features/customers/hooks/use-customers"
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
  cupsLoading,
  lidsLoading,
  nonStockItemsLoading,
  isAdmin,
}: {
  index: number
  fieldId: string
  activeCups: Cup[]
  activeLids: Lid[]
  activeNonStockItems: NonStockItem[]
  cupsLoading: boolean
  lidsLoading: boolean
  nonStockItemsLoading: boolean
  isAdmin: boolean
}) {
  const { control, setValue, getValues } = useFormContext<OrderCreateValues>()
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
                <SelectTrigger className="w-full rounded-none">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="rounded-none">
                <SelectItem value="cup">Cup</SelectItem>
                <SelectItem value="lid">Lid</SelectItem>
                <SelectItem value="non_stock_item">General Item</SelectItem>
                <SelectItem value="custom_charge" disabled={!isAdmin}>
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
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[15%_35%_10%_40%]">
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
                    <SelectTrigger className="w-full rounded-none">
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
                  <SelectContent className="rounded-none">
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
        </div>
      )}
    </div>
  )
}

export function OrderCreatePage() {
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const cupsQuery = useCupsQuery()
  const lidsQuery = useLidsQuery()
  const nonStockItemsQuery = useNonStockItemsQuery()
  const createOrderMutation = useCreateOrderMutation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isAdmin = currentUser.data?.role === "admin"
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
    <Card >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="grid gap-1">
            <CardTitle>Create Pending Order</CardTitle>
          </div>
          <Button asChild variant="outline">
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
                                cupsLoading={cupsQuery.isLoading}
                                lidsLoading={lidsQuery.isLoading}
                                nonStockItemsLoading={nonStockItemsQuery.isLoading}
                                isAdmin={isAdmin}
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

            <Button
              type="submit"
              className="rounded-none"
              disabled={createOrderMutation.isPending || cupsQuery.isLoading || lidsQuery.isLoading}
            >
              {createOrderMutation.isPending ? "Creating order..." : "Create pending order"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
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
