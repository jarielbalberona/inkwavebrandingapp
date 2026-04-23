import { useMemo, useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate } from "@tanstack/react-router"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
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
  FormMessage,
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

import { CustomerSearchSelect } from "@/features/customers/components/customer-search-select"
import type { Lid } from "@/features/lids/api/lids-client"
import { useLidsQuery } from "@/features/lids/hooks/use-lids"
import type { Cup } from "@/features/cups/api/cups-client"
import { useCupsQuery } from "@/features/cups/hooks/use-cups"
import { useCreateOrderMutation } from "@/features/orders/hooks/use-orders"

const orderCreateSchema = z.object({
  customer_id: z.string().uuid({ message: "Select a customer." }),
  notes: z.string().trim().max(1000).optional(),
  line_items: z
    .array(
      z.object({
        item_type: z.enum(["cup", "lid"]),
        item_id: z.string().uuid({ message: "Select a source item." }),
        quantity: z.number().int().positive("Quantity must be a positive whole number."),
        notes: z.string().trim().max(500).optional(),
      }),
    )
    .min(1, "Add at least one line item."),
})

type OrderCreateValues = z.infer<typeof orderCreateSchema>

const emptyLineItem: OrderCreateValues["line_items"][number] = {
  item_type: "cup",
  item_id: "",
  quantity: 1,
  notes: "",
}

export function OrderCreatePage() {
  const navigate = useNavigate()
  const cupsQuery = useCupsQuery()
  const lidsQuery = useLidsQuery()
  const createOrderMutation = useCreateOrderMutation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const activeCups = useMemo(
    () => (cupsQuery.data ?? []).filter((cup) => cup.is_active),
    [cupsQuery.data],
  )
  const activeLids = useMemo(
    () => (lidsQuery.data ?? []).filter((lid) => lid.is_active),
    [lidsQuery.data],
  )

  const form = useForm<OrderCreateValues>({
    resolver: zodResolver(orderCreateSchema),
    defaultValues: {
      customer_id: "",
      notes: "",
      line_items: [emptyLineItem],
    },
  })

  const lineItems = useWatch({
    control: form.control,
    name: "line_items",
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items",
  })

  async function onSubmit(values: OrderCreateValues) {
    setSubmitError(null)

    const uniqueKeys = values.line_items.map((item) => `${item.item_type}:${item.item_id}`)

    if (new Set(uniqueKeys).size !== uniqueKeys.length) {
      setSubmitError("Each source item can only appear once per order.")
      return
    }

    try {
      const order = await createOrderMutation.mutateAsync({
        customer_id: values.customer_id,
        notes: values.notes?.trim() || undefined,
        line_items: values.line_items.map((item) =>
          item.item_type === "cup"
            ? {
                item_type: "cup",
                cup_id: item.item_id,
                quantity: item.quantity,
                notes: item.notes?.trim() || undefined,
              }
            : {
                item_type: "lid",
                lid_id: item.item_id,
                quantity: item.quantity,
                notes: item.notes?.trim() || undefined,
          },
        ),
      })

      void order
      await navigate({ to: "/orders" })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to create order.")
    }
  }

  return (
    <Card className="rounded-none">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle>Create Pending Order</CardTitle>
            <CardDescription>
              Use the corrected mixed-item order contract. Submission creates a pending order and reserves stock.
            </CardDescription>
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
                  <FormControl>
                    <CustomerSearchSelect
                      selectedCustomerId={field.value || null}
                      onSelect={(customer) => field.onChange(customer.id)}
                    />
                  </FormControl>
                  
                </FormItem>
              )}
            />

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <FormLabel>Line items</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ ...emptyLineItem })}
                >
                  Add item
                </Button>
              </div>

              {fields.map((field, index) => {
                const lineItem = lineItems[index]
                const itemType = lineItem?.item_type ?? "cup"
                const availableItems = itemType === "cup" ? activeCups : activeLids

                return (
                  <div key={field.id} className="grid gap-3 border p-3">
                    <div className="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)_10rem]">
                      <FormField
                        control={form.control}
                        name={`line_items.${index}.item_type`}
                        render={({ field: itemTypeField }) => (
                          <FormItem>
                            <FormLabel>Item type</FormLabel>
                            <Select
                              value={itemTypeField.value}
                              onValueChange={(value) => {
                                itemTypeField.onChange(value)
                                form.setValue(`line_items.${index}.item_id`, "", {
                                  shouldValidate: true,
                                })
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
                              </SelectContent>
                            </Select>
                            
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`line_items.${index}.item_id`}
                        render={({ field: itemIdField }) => (
                          <FormItem>
                            <FormLabel>{itemType === "cup" ? "Cup SKU" : "Lid"}</FormLabel>
                            <Select value={itemIdField.value} onValueChange={itemIdField.onChange}>
                              <FormControl>
                                <SelectTrigger className="w-full rounded-none">
                                  <SelectValue
                                    placeholder={
                                      itemType === "cup"
                                        ? cupsQuery.isLoading
                                          ? "Loading cups..."
                                          : "Select cup"
                                        : lidsQuery.isLoading
                                          ? "Loading lids..."
                                          : "Select lid"
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-none">
                                {availableItems.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {itemType === "cup"
                                      ? formatCupOption(item as Cup)
                                      : formatLidOption(item as Lid)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
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
                    </div>

                    <FormField
                      control={form.control}
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

                    {fields.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="justify-self-start px-0"
                        onClick={() => remove(index)}
                      >
                        Remove item {index + 1}
                      </Button>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="Optional order note" />
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
  return `${lid.type} · ${lid.brand} · ${lid.diameter} · ${lid.shape} · ${lid.color}`
}
