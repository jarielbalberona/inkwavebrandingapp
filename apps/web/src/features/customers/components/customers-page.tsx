import { useDeferredValue, useMemo, useState } from "react"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
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
import type { Customer, CustomerPayload } from "@/features/customers/api/customers-client"
import {
  useCreateCustomerMutation,
  useCustomersQuery,
  useUpdateCustomerMutation,
} from "@/features/customers/hooks/use-customers"

const emptyForm: CustomerPayload = {
  customerCode: "",
  businessName: "",
  contactPerson: "",
  contactNumber: "",
  email: "",
  address: "",
  notes: "",
  isActive: true,
}

export function CustomersPage() {
  const currentUser = useCurrentUser()
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const customersQuery = useCustomersQuery({ includeInactive: true, search: deferredSearch })
  const createCustomer = useCreateCustomerMutation()
  const updateCustomer = useUpdateCustomerMutation()
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [form, setForm] = useState<CustomerPayload>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const selectedCustomer = useMemo(
    () => customersQuery.data?.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customersQuery.data, selectedCustomerId],
  )
  const isAdmin = currentUser.data?.role === "admin"
  const canEditConfidentialFields = isAdmin && (!selectedCustomer || "contact_person" in selectedCustomer)

  const saveCustomer = () => {
    const validation = validateForm(form)

    setFormError(validation)

    if (validation) {
      return
    }

    const payload = toPayload(form)

    if (selectedCustomer) {
      updateCustomer.mutate(
        { id: selectedCustomer.id, payload },
        {
          onError: (error) => setFormError(error.message),
        },
      )
      return
    }

    createCustomer.mutate(payload, {
      onError: (error) => setFormError(error.message),
      onSuccess: () => {
        setForm(emptyForm)
      },
    })
  }

  const resetForm = () => {
    setSelectedCustomerId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Customer Records</CardTitle>
          <CardDescription>
            Maintain first-class customers for order selection. Staff receive operational customer summaries only.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="customer-search">Search customers</Label>
            <Input
              id="customer-search"
              value={search}
              placeholder="Search name, code, contact, email, or phone"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {customersQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{customersQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {customersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading customer records...</p>
          ) : null}

          {!customersQuery.isLoading && customersQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No customers found. Admins can create the first customer record.
            </p>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customersQuery.data?.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  data-state={customer.id === selectedCustomerId ? "selected" : undefined}
                  onClick={() => {
                    setSelectedCustomerId(customer.id)
                    setForm(toFormState(customer))
                    setFormError(null)
                  }}
                >
                  <TableCell className="font-medium">{customer.business_name}</TableCell>
                  <TableCell>{customer.customer_code ?? "None"}</TableCell>
                  <TableCell>{formatContact(customer)}</TableCell>
                  <TableCell>
                    <Badge variant={customer.is_active ? "default" : "secondary"}>
                      {customer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>{selectedCustomer ? "Customer Detail" : "Create Customer"}</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Admins can create and edit customer records."
              : "Staff can inspect customer records but cannot edit confidential customer data."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <CustomerField
            label="Customer code"
            value={form.customerCode ?? ""}
            disabled={!isAdmin}
            onChange={(value) => setForm({ ...form, customerCode: value })}
          />
          <CustomerField
            label="Business or customer name"
            value={form.businessName}
            disabled={!isAdmin}
            onChange={(value) => setForm({ ...form, businessName: value })}
          />
          <CustomerField
            label="Contact person"
            value={form.contactPerson ?? ""}
            disabled={!canEditConfidentialFields}
            onChange={(value) => setForm({ ...form, contactPerson: value })}
          />
          <CustomerField
            label="Contact number"
            value={form.contactNumber ?? ""}
            disabled={!canEditConfidentialFields}
            onChange={(value) => setForm({ ...form, contactNumber: value })}
          />
          <CustomerField
            label="Email"
            value={form.email ?? ""}
            disabled={!canEditConfidentialFields}
            onChange={(value) => setForm({ ...form, email: value })}
          />
          <CustomerTextArea
            label="Address"
            value={form.address ?? ""}
            disabled={!canEditConfidentialFields}
            onChange={(value) => setForm({ ...form, address: value })}
          />
          <CustomerTextArea
            label="Notes"
            value={form.notes ?? ""}
            disabled={!canEditConfidentialFields}
            onChange={(value) => setForm({ ...form, notes: value })}
          />

          {isAdmin ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                Active customer record
              </label>
              <div className="flex gap-2">
                <Button type="button" onClick={saveCustomer} disabled={createCustomer.isPending || updateCustomer.isPending}>
                  {selectedCustomer ? "Save Changes" : "Create Customer"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  New
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function CustomerField({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function CustomerTextArea({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Textarea value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function formatContact(customer: Customer): string {
  return customer.contact_person ?? customer.email ?? customer.contact_number ?? "Restricted"
}

function toFormState(customer: Customer): CustomerPayload {
  return {
    customerCode: customer.customer_code ?? "",
    businessName: customer.business_name,
    contactPerson: customer.contact_person ?? "",
    contactNumber: customer.contact_number ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    notes: customer.notes ?? "",
    isActive: customer.is_active,
  }
}

function toPayload(form: CustomerPayload): CustomerPayload {
  return {
    customerCode: cleanOptional(form.customerCode),
    businessName: form.businessName.trim(),
    contactPerson: cleanOptional(form.contactPerson),
    contactNumber: cleanOptional(form.contactNumber),
    email: cleanOptional(form.email),
    address: cleanOptional(form.address),
    notes: cleanOptional(form.notes),
    isActive: form.isActive,
  }
}

function cleanOptional(value: string | undefined): string | undefined {
  return value?.trim() || undefined
}

function validateForm(form: CustomerPayload): string | null {
  if (!form.businessName.trim()) {
    return "Business or customer name is required."
  }

  if (form.customerCode && !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(form.customerCode.trim())) {
    return "Customer code must use letters, numbers, hyphens, or underscores."
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Enter a valid email address."
  }

  return null
}
