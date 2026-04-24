import type { SafeUser } from "../auth/auth.schemas.js"
import { assertPermission, AuthorizationError } from "../auth/authorization.js"
import type {
  CreateNonStockItemInput,
  NonStockItemListQuery,
  UpdateNonStockItemInput,
} from "./non-stock-items.schemas.js"
import { NonStockItemsRepository } from "./non-stock-items.repository.js"
import { toNonStockItemDto, type NonStockItemDto } from "./non-stock-items.types.js"

export class NonStockItemNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Non-stock item not found")
  }
}

export class DuplicateNonStockItemNameError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Non-stock item name already exists")
  }
}

export class NonStockItemPersistenceValidationError extends Error {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
  }
}

export class NonStockItemsService {
  constructor(private readonly nonStockItemsRepository: NonStockItemsRepository) {}

  async list(query: NonStockItemListQuery, user: SafeUser): Promise<NonStockItemDto[]> {
    assertPermission(user, "non_stock_items.view")

    const nonStockItems = await this.nonStockItemsRepository.list({
      includeInactive: query.include_inactive,
      name: query.name,
    })

    return nonStockItems.map((nonStockItem) => toNonStockItemDto(nonStockItem, user))
  }

  async getById(id: string, user: SafeUser): Promise<NonStockItemDto> {
    assertPermission(user, "non_stock_items.view")

    const nonStockItem = await this.nonStockItemsRepository.findById(id)

    if (!nonStockItem) {
      throw new NonStockItemNotFoundError()
    }

    return toNonStockItemDto(nonStockItem, user)
  }

  async create(input: CreateNonStockItemInput, user: SafeUser): Promise<NonStockItemDto> {
    assertPermission(user, "non_stock_items.manage")

    try {
      return toNonStockItemDto(await this.nonStockItemsRepository.create(input), user)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateNonStockItemNameError()
      }

      const persistenceValidationError = toNonStockItemPersistenceValidationError(error)
      if (persistenceValidationError) {
        throw persistenceValidationError
      }

      throw error
    }
  }

  async update(
    id: string,
    input: UpdateNonStockItemInput,
    user: SafeUser,
  ): Promise<NonStockItemDto> {
    assertPermission(user, "non_stock_items.manage")

    try {
      const existingNonStockItem = await this.nonStockItemsRepository.findById(id)

      if (!existingNonStockItem) {
        throw new NonStockItemNotFoundError()
      }

      const nonStockItem = await this.nonStockItemsRepository.update(id, input)

      if (!nonStockItem) {
        throw new NonStockItemNotFoundError()
      }

      return toNonStockItemDto(nonStockItem, user)
    } catch (error) {
      if (error instanceof AuthorizationError || error instanceof NonStockItemNotFoundError) {
        throw error
      }

      if (isUniqueViolation(error)) {
        throw new DuplicateNonStockItemNameError()
      }

      const persistenceValidationError = toNonStockItemPersistenceValidationError(error)
      if (persistenceValidationError) {
        throw persistenceValidationError
      }

      throw error
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return getDbErrorCode(error) === "23505"
}

function toNonStockItemPersistenceValidationError(
  error: unknown,
): NonStockItemPersistenceValidationError | null {
  const code = getDbErrorCode(error)
  const detail = getDbErrorDetail(error)
  const message = getDbErrorMessage(error)

  if (code === "23514" || code === "23502" || code === "22P02") {
    return new NonStockItemPersistenceValidationError(
      detail || message || "Non-stock item data failed database validation.",
    )
  }

  return null
}

function getDbErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null
  }

  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code
  }

  if ("cause" in error) {
    return getDbErrorCode((error as { cause?: unknown }).cause)
  }

  return null
}

function getDbErrorDetail(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null
  }

  if ("detail" in error && typeof (error as { detail?: unknown }).detail === "string") {
    return (error as { detail: string }).detail
  }

  if ("cause" in error) {
    return getDbErrorDetail((error as { cause?: unknown }).cause)
  }

  return null
}

function getDbErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null
  }

  if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message
  }

  if ("cause" in error) {
    return getDbErrorMessage((error as { cause?: unknown }).cause)
  }

  return null
}
