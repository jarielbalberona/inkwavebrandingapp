import { useEffect, useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
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
import { Textarea } from "@workspace/ui/components/textarea"

import { CustomerSearchSelect } from "@/features/customers/components/customer-search-select"
import { useOrderQuery, useUpdateOrderMutation } from "@/features/orders/hooks/use-orders"

const orderEditSchema = z.object({
  customer_id: z.string().uuid({ message: "Select a customer." }),
  notes: z.string().trim().max(1000).optional(),
})

type OrderEditValues = z.infer<typeof orderEditSchema>

export function OrderEditPage({ orderId }: { orderId: string }) {
  const navigate = useNavigate()
  const orderQuery = useOrderQuery(orderId)
  const updateOrderMutation = useUpdateOrderMutation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const form = useForm<OrderEditValues>({
    resolver: zodResolver(orderEditSchema),
    defaultValues: {
      customer_id: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (!orderQuery.data) {
      return
    }

    form.reset({
      customer_id: orderQuery.data.customer.id,
      notes: orderQuery.data.notes ?? "",
    })
  }, [form, orderQuery.data])

  async function onSubmit(values: OrderEditValues) {
    setSubmitError(null)
    setSubmitSuccess(null)

    try {
      const order = await updateOrderMutation.mutateAsync({
        id: orderId,
        payload: {
          customer_id:
            values.customer_id !== orderQuery.data?.customer.id ? values.customer_id : undefined,
          notes:
            (values.notes?.trim() || null) !== (orderQuery.data?.notes ?? null)
              ? values.notes?.trim() || null
              : undefined,
        },
      })

      setSubmitSuccess(`Updated ${order.order_number}.`)
      await navigate({ to: "/orders" })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to update order.")
    }
  }

  return (
    <Card className="rounded-none">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle>Edit Order</CardTitle>
            <CardDescription>
              Edit guarded order fields on a dedicated page. Line items stay read-only here until a later explicit workflow changes that rule.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link to="/orders/$orderId" params={{ orderId }}>
              Cancel
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

        {orderQuery.data ? (
          <>
            <div className="grid gap-2 border p-4 text-sm">
              <p className="font-medium">{orderQuery.data.order_number}</p>
              <p className="text-muted-foreground">Status: {orderQuery.data.status}</p>
              <p className="text-muted-foreground">
                Line items stay operationally managed through fulfillment flows. This page only edits allowed metadata.
              </p>
            </div>

            <Form {...form}>
              <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <CustomerSearchSelect
                          includeInactive
                          selectedCustomerId={field.value || null}
                          onSelect={(customer) => field.onChange(customer.id)}
                        />
                      </FormControl>
                      
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ""} />
                      </FormControl>
                      
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="rounded-none"
                  disabled={
                    updateOrderMutation.isPending ||
                    orderQuery.data.status === "canceled" ||
                    orderQuery.data.status === "completed"
                  }
                >
                  {updateOrderMutation.isPending ? "Saving order..." : "Save allowed edits"}
                </Button>
              </form>
            </Form>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
