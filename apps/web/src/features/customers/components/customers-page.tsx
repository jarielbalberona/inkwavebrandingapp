import { useDeferredValue, useEffect, useMemo, useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
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
  FormMessage,
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
import type { Customer, CustomerPayload } from "@/features/customers/api/customers-client"
import {
  useCreateCustomerMutation,
  useCustomersQuery,
  useUpdateCustomerMutation,
} from "@/features/customers/hooks/use-customers"

const customerFormSchema = z.object({
  customerCode: z.string().trim().max(80).optional(),
  businessName: z.string().trim().min(1).max(160),
  contactPerson: z.string().trim().max(160).optional(),
  contactNumber: z.string().trim().max(40).optional(),
  email: z.union([z.string().trim().email().max(320), z.literal("")]).optional(),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
  isActive: z.boolean(),
})

type CustomerFormValues = z.infer<typeof customerFormSchema>

const emptyFormValues: CustomerFormValues = {
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const selectedCustomer = useMemo(
    () => customersQuery.data?.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customersQuery.data, selectedCustomerId],
  )
  const isAdmin = currentUser.data?.role === "admin"
  const canEditConfidentialFields = isAdmin && (!selectedCustomer || "contact_person" in selectedCustomer)

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: emptyFormValues,
  })

  useEffect(() => {
    if (!dialogOpen) {
      return
    }

    form.reset(selectedCustomer ? toFormValues(selectedCustomer) : emptyFormValues)
  }, [dialogOpen, selectedCustomer, form])

  async function onSubmit(values: CustomerFormValues) {
    setSubmitError(null)

    const payload = toPayload(values)

    try {
      if (selectedCustomer) {
        await updateCustomer.mutateAsync({ id: selectedCustomer.id, payload })
      } else {
        await createCustomer.mutateAsync(payload)
      }

      setDialogOpen(false)
      setSelectedCustomerId(null)
      form.reset(emptyFormValues)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save customer.")
    }
  }

  function openCreateDialog() {
    setSelectedCustomerId(null)
    setDialogOpen(true)
  }

  function openDetailDialog(customer: Customer) {
    setSelectedCustomerId(customer.id)
    setDialogOpen(true)
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-none">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <CardTitle>Customer Records</CardTitle>
            <CardDescription>
              Maintain first-class customers for order selection. Staff receive operational customer summaries only.
            </CardDescription>
          </div>
          {isAdmin ? <Button onClick={openCreateDialog}>Create Customer</Button> : null}
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
                  onClick={() => openDetailDialog(customer)}
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setSelectedCustomerId(null)
            form.reset(emptyFormValues)
            setSubmitError(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCustomer ? "Customer Detail" : "Create Customer"}</DialogTitle>
            <DialogDescription>
              {isAdmin
                ? "Maintain customer records with shared form primitives."
                : "Staff can inspect customer records but cannot edit confidential customer data."}
            </DialogDescription>
          </DialogHeader>

          {submitError ? (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextFormField control={form.control} disabled={!isAdmin} label="Customer code" name="customerCode" />
                <TextFormField control={form.control} disabled={!isAdmin} label="Business name" name="businessName" />
                <TextFormField control={form.control} disabled={!canEditConfidentialFields} label="Contact person" name="contactPerson" />
                <TextFormField control={form.control} disabled={!canEditConfidentialFields} label="Contact number" name="contactNumber" />
              </div>
              <TextFormField control={form.control} disabled={!canEditConfidentialFields} label="Email" name="email" />
              <TextAreaFormField control={form.control} disabled={!canEditConfidentialFields} label="Address" name="address" />
              <TextAreaFormField control={form.control} disabled={!canEditConfidentialFields} label="Notes" name="notes" />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 rounded-none border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        disabled={!isAdmin}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                    </FormControl>
                    <div className="grid gap-1">
                      <FormLabel>Active customer record</FormLabel>
                      <FormDescription>Inactive customers remain searchable for history but should not be used for new work.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter showCloseButton>
                {isAdmin ? (
                  <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
                    {selectedCustomer ? "Save Changes" : "Create Customer"}
                  </Button>
                ) : null}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TextFormField({
  control,
  disabled,
  label,
  name,
}: {
  control: ReturnType<typeof useForm<CustomerFormValues>>["control"]
  disabled: boolean
  label: string
  name: keyof CustomerFormValues
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              disabled={disabled}
              value={typeof field.value === "string" ? field.value : ""}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </FormControl>
          
        </FormItem>
      )}
    />
  )
}

function TextAreaFormField({
  control,
  disabled,
  label,
  name,
}: {
  control: ReturnType<typeof useForm<CustomerFormValues>>["control"]
  disabled: boolean
  label: string
  name: "address" | "notes"
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              disabled={disabled}
              value={field.value ?? ""}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </FormControl>
          
        </FormItem>
      )}
    />
  )
}

function toFormValues(customer: Customer): CustomerFormValues {
  return {
    customerCode: customer.customer_code ?? "",
    businessName: customer.business_name,
    contactPerson: "contact_person" in customer ? customer.contact_person ?? "" : "",
    contactNumber: "contact_number" in customer ? customer.contact_number ?? "" : "",
    email: "email" in customer ? customer.email ?? "" : "",
    address: "address" in customer ? customer.address ?? "" : "",
    notes: "notes" in customer ? customer.notes ?? "" : "",
    isActive: customer.is_active,
  }
}

function toPayload(values: CustomerFormValues): CustomerPayload {
  return {
    customerCode: values.customerCode?.trim() || undefined,
    businessName: values.businessName.trim(),
    contactPerson: values.contactPerson?.trim() || undefined,
    contactNumber: values.contactNumber?.trim() || undefined,
    email: values.email?.trim() || undefined,
    address: values.address?.trim() || undefined,
    notes: values.notes?.trim() || undefined,
    isActive: values.isActive,
  }
}

function formatContact(customer: Customer) {
  if ("contact_person" in customer && customer.contact_person) {
    return customer.contact_person
  }

  return "Restricted"
}
