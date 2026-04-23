import { z } from "zod"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

export const customerSchema = z.object({
  id: z.string().uuid(),
  customer_code: z.string().nullable(),
  business_name: z.string(),
  contact_person: z.string().nullable().optional(),
  contact_number: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const customersResponseSchema = z.object({ customers: z.array(customerSchema) })
const customerResponseSchema = z.object({ customer: customerSchema })

export type Customer = z.infer<typeof customerSchema>

export interface CustomerPayload {
  customerCode?: string
  businessName: string
  contactPerson?: string
  contactNumber?: string
  email?: string
  address?: string
  notes?: string
  isActive: boolean
}

export class CustomersApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function listCustomers(filters: {
  includeInactive?: boolean
  search?: string
} = {}): Promise<Customer[]> {
  const searchParams = new URLSearchParams()

  if (filters.includeInactive) {
    searchParams.set("include_inactive", "true")
  }

  if (filters.search?.trim()) {
    searchParams.set("search", filters.search.trim())
  }

  const queryString = searchParams.toString()
  const response = await fetch(`${apiBaseUrl}/customers${queryString ? `?${queryString}` : ""}`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new CustomersApiError("Unable to load customers.", response.status)
  }

  return customersResponseSchema.parse(await response.json()).customers
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  const response = await sendCustomerRequest("/customers", "POST", payload)

  return customerResponseSchema.parse(await response.json()).customer
}

export async function updateCustomer(id: string, payload: Partial<CustomerPayload>): Promise<Customer> {
  const response = await sendCustomerRequest(`/customers/${id}`, "PATCH", payload)

  return customerResponseSchema.parse(await response.json()).customer
}

async function sendCustomerRequest(
  path: string,
  method: "POST" | "PATCH",
  payload: CustomerPayload | Partial<CustomerPayload>,
) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 400) {
    throw new CustomersApiError("Check the customer fields and try again.", response.status)
  }

  if (response.status === 403) {
    throw new CustomersApiError("Only admins can change customer records.", response.status)
  }

  if (response.status === 404) {
    throw new CustomersApiError("Customer no longer exists.", response.status)
  }

  if (response.status === 409) {
    throw new CustomersApiError("Customer code already exists. Use a different code.", response.status)
  }

  if (!response.ok) {
    throw new CustomersApiError("Unable to save customer.", response.status)
  }

  return response
}
