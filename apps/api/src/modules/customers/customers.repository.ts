import { and, asc, eq, ilike, or, sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { customers, type Customer } from "../../db/schema/index.js"
import type {
  CreateCustomerInput,
  CustomerListQuery,
  UpdateCustomerInput,
} from "./customers.schemas.js"

export class CustomersRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateCustomerInput): Promise<Customer> {
    const rows = await this.db
      .insert(customers)
      .values({
        customerCode: input.customerCode,
        businessName: input.businessName,
        contactPerson: input.contactPerson,
        contactNumber: input.contactNumber,
        email: input.email,
        address: input.address,
        notes: input.notes,
        isActive: input.isActive,
      })
      .returning()

    const customer = rows[0]

    if (!customer) {
      throw new Error("Failed to create customer")
    }

    return customer
  }

  async findById(id: string): Promise<Customer | undefined> {
    const rows = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1)

    return rows[0]
  }

  async findByCustomerCode(customerCode: string): Promise<Customer | undefined> {
    const rows = await this.db
      .select()
      .from(customers)
      .where(eq(sql<string>`upper(${customers.customerCode})`, customerCode.toUpperCase()))
      .limit(1)

    return rows[0]
  }

  async list(query: CustomerListQuery): Promise<Customer[]> {
    const conditions = [
      query.include_inactive ? undefined : eq(customers.isActive, true),
      query.search
        ? or(
            ilike(customers.businessName, `%${query.search}%`),
            ilike(customers.customerCode, `%${query.search}%`),
            ilike(customers.contactPerson, `%${query.search}%`),
            ilike(customers.contactNumber, `%${query.search}%`),
            ilike(customers.email, `%${query.search}%`),
          )
        : undefined,
    ].filter(Boolean)

    return this.db
      .select()
      .from(customers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(customers.businessName))
  }

  async update(id: string, input: UpdateCustomerInput): Promise<Customer | undefined> {
    const rows = await this.db
      .update(customers)
      .set({
        customerCode: input.customerCode,
        businessName: input.businessName,
        contactPerson: input.contactPerson,
        contactNumber: input.contactNumber,
        email: input.email,
        address: input.address,
        notes: input.notes,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning()

    return rows[0]
  }
}
