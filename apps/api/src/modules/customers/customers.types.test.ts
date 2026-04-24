import test from "node:test"
import assert from "node:assert/strict"

import { findStaffRestrictedKeys } from "../auth/role-safe-response.js"
import { toCustomerDto } from "./customers.types.js"

const customer = {
  id: "11111111-1111-1111-1111-111111111111",
  customerCode: "CUST-001",
  businessName: "Ink Wave Cafe",
  contactPerson: "Jane Doe",
  contactNumber: "09170000000",
  email: "jane@example.com",
  address: "Manila",
  notes: "Priority customer",
  isActive: true,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z"),
} as const

test("toCustomerDto strips confidential fields for staff", () => {
  const dto = toCustomerDto(customer as never, { role: "staff", permissions: [] })

  assert.equal("contact_person" in dto, false)
  assert.equal("email" in dto, false)
  assert.deepEqual(findStaffRestrictedKeys(dto), [])
})

test("toCustomerDto keeps confidential fields for admin", () => {
  const dto = toCustomerDto(customer as never, { role: "admin", permissions: [] })

  assert.equal("contact_person" in dto, true)
  assert.equal("email" in dto, true)
})
