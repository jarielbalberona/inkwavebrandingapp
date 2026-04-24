import { useDeferredValue, useMemo, useState } from "react"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import type { Customer } from "@/features/customers/api/customers-client"
import { useCustomersQuery } from "@/features/customers/hooks/use-customers"

export function CustomerSearchSelect({
  includeInactive = false,
  onSelect,
  selectedCustomerId,
}: {
  includeInactive?: boolean
  onSelect: (customer: Customer) => void
  selectedCustomerId: string | null
}) {
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const customersQuery = useCustomersQuery({ includeInactive, search: deferredSearch })
  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data])
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  )

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="order-customer-search">Customer</Label>
        <Input
          id="order-customer-search"
          value={search}
          placeholder="Search by customer code, name, contact, email, or phone"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {customersQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{customersQuery.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {customersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Searching customers...</p>
      ) : null}

      {!customersQuery.isLoading && customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active customers found. Create or reactivate a customer record before creating an order.
        </p>
      ) : null}

      <div className="grid gap-2">
        {customers.slice(0, 8).map((customer) => {
          const isSelected = customer.id === selectedCustomerId
          const isInactive = !customer.is_active

          return (
            <button
              key={customer.id}
              type="button"
              disabled={isInactive}
              className="border bg-card p-3 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 data-[selected=true]:border-primary"
              data-selected={isSelected}
              onClick={() => onSelect(customer)}
            >
              <span className="flex items-start justify-between gap-3">
              <div className="flex items-center align-middle gap-2">
                    <span className="font-medium">{customer.business_name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({customer.contact_person ? `${customer.contact_person}` : ""} {customer.contact_number ? ` · ${customer.contact_number}` : ""})
                    </span>
                  </div>
              </span>
            </button>
          )
        })}
      </div>

      {selectedCustomer ? (
        <Card>
          <CardContent className="grid gap-2 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">Selected customer</span>
              <Badge variant="secondary">Selected</Badge>
            </div>
            <p>{selectedCustomer.business_name}</p>
            <p className="text-muted-foreground">
              Orders should store this customer as `customer_id`: {selectedCustomer.id}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
