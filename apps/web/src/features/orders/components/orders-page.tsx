import { useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import type { Customer } from "@/features/customers/api/customers-client"
import { CustomerSearchSelect } from "@/features/customers/components/customer-search-select"

export function OrdersPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>
            Order persistence is not implemented yet. This screen exposes the customer selection dependency
            future order create/edit forms must use instead of free-typed customer fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div>
            <p className="font-medium">Selected order customer</p>
            <p className="text-muted-foreground">
              {selectedCustomer
                ? `${selectedCustomer.business_name} (${selectedCustomer.customer_code ?? selectedCustomer.id})`
                : "No customer selected yet."}
            </p>
          </div>
          <p className="text-muted-foreground">
            Full order creation, line items, reservations, and fulfillment progress remain in Orders Core tickets.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Select Customer</CardTitle>
          <CardDescription>
            Search active customer records. Order creation must persist the selected customer ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerSearchSelect
            selectedCustomerId={selectedCustomer?.id ?? null}
            onSelect={setSelectedCustomer}
          />
        </CardContent>
      </Card>
    </div>
  )
}
