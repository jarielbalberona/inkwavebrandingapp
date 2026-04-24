import type { SafeUser } from "../auth/auth.schemas.js"
import { assertPermission, AuthorizationError } from "../auth/authorization.js"
import type {
  CreateCustomerInput,
  CustomerListQuery,
  UpdateCustomerInput,
} from "./customers.schemas.js"
import { CustomersRepository } from "./customers.repository.js"
import { toCustomerDto, type CustomerDto } from "./customers.types.js"

export class CustomerNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Customer not found")
  }
}

export class DuplicateCustomerCodeError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Customer code already exists")
  }
}

export class CustomersService {
  constructor(private readonly customersRepository: CustomersRepository) {}

  async list(query: CustomerListQuery, user: SafeUser): Promise<CustomerDto[]> {
    assertPermission(user, "customers.view")

    const customers = await this.customersRepository.list(query)
    return customers.map((customer) => toCustomerDto(customer, user))
  }

  async getById(id: string, user: SafeUser): Promise<CustomerDto> {
    assertPermission(user, "customers.view")

    const customer = await this.customersRepository.findById(id)

    if (!customer) {
      throw new CustomerNotFoundError()
    }

    return toCustomerDto(customer, user)
  }

  async create(input: CreateCustomerInput, user: SafeUser): Promise<CustomerDto> {
    assertPermission(user, "customers.manage")

    try {
      return toCustomerDto(await this.customersRepository.create(input), user)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateCustomerCodeError()
      }

      throw error
    }
  }

  async update(id: string, input: UpdateCustomerInput, user: SafeUser): Promise<CustomerDto> {
    assertPermission(user, "customers.manage")

    try {
      const customer = await this.customersRepository.update(id, input)

      if (!customer) {
        throw new CustomerNotFoundError()
      }

      return toCustomerDto(customer, user)
    } catch (error) {
      if (error instanceof AuthorizationError || error instanceof CustomerNotFoundError) {
        throw error
      }

      if (isUniqueViolation(error)) {
        throw new DuplicateCustomerCodeError()
      }

      throw error
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505",
  )
}
