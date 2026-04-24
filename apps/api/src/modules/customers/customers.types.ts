import type { Customer } from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { shapePermissionAwareResponse } from "../auth/role-safe-response.js"

export interface AdminCustomerDto {
  id: string
  customer_code: string | null
  business_name: string
  contact_person: string | null
  contact_number: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type StaffCustomerDto = Pick<
  AdminCustomerDto,
  "id" | "customer_code" | "business_name" | "is_active" | "created_at" | "updated_at"
>

export type CustomerDto = AdminCustomerDto | StaffCustomerDto

export function toCustomerDto(customer: Customer, user: Pick<SafeUser, "role" | "permissions">): CustomerDto {
  return shapePermissionAwareResponse(user, "customers.confidential.view", {
    allowed: () => toAdminCustomerDto(customer),
    restricted: () => toStaffCustomerDto(customer),
  })
}

function toAdminCustomerDto(customer: Customer): AdminCustomerDto {
  return {
    id: customer.id,
    customer_code: customer.customerCode ?? null,
    business_name: customer.businessName,
    contact_person: customer.contactPerson ?? null,
    contact_number: customer.contactNumber ?? null,
    email: customer.email ?? null,
    address: customer.address ?? null,
    notes: customer.notes ?? null,
    is_active: customer.isActive,
    created_at: customer.createdAt.toISOString(),
    updated_at: customer.updatedAt.toISOString(),
  }
}

function toStaffCustomerDto(customer: Customer): StaffCustomerDto {
  const {
    contact_person,
    contact_number,
    email,
    address,
    notes,
    ...staffDto
  } = toAdminCustomerDto(customer)

  void contact_person
  void contact_number
  void email
  void address
  void notes

  return staffDto
}
