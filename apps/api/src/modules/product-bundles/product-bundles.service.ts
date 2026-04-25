import type { SafeUser } from "../auth/auth.schemas.js"
import { assertPermission, AuthorizationError } from "../auth/authorization.js"
import { ProductBundlesRepository } from "./product-bundles.repository.js"
import type {
  CreateProductBundleInput,
  ProductBundleListQuery,
  UpdateProductBundleInput,
} from "./product-bundles.schemas.js"
import { toProductBundleDto, type ProductBundleDto } from "./product-bundles.types.js"

export class ProductBundleNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Product bundle not found")
  }
}

export class DuplicateProductBundleNameError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Product bundle name already exists")
  }
}

export class ProductBundlePersistenceValidationError extends Error {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
  }
}

export class ProductBundlesService {
  constructor(private readonly productBundlesRepository: ProductBundlesRepository) {}

  async list(query: ProductBundleListQuery, user: SafeUser): Promise<ProductBundleDto[]> {
    assertPermission(user, "product_bundles.view")

    const productBundles = await this.productBundlesRepository.list({
      includeInactive: query.include_inactive,
      name: query.name,
    })

    return productBundles.map(toProductBundleDto)
  }

  async getById(id: string, user: SafeUser): Promise<ProductBundleDto> {
    assertPermission(user, "product_bundles.view")

    const productBundle = await this.productBundlesRepository.findById(id)

    if (!productBundle) {
      throw new ProductBundleNotFoundError()
    }

    return toProductBundleDto(productBundle)
  }

  async create(input: CreateProductBundleInput, user: SafeUser): Promise<ProductBundleDto> {
    assertPermission(user, "product_bundles.manage")

    try {
      return toProductBundleDto(await this.productBundlesRepository.create(input))
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateProductBundleNameError()
      }

      const persistenceValidationError = toProductBundlePersistenceValidationError(error)
      if (persistenceValidationError) {
        throw persistenceValidationError
      }

      throw error
    }
  }

  async update(
    id: string,
    input: UpdateProductBundleInput,
    user: SafeUser,
  ): Promise<ProductBundleDto> {
    assertPermission(user, "product_bundles.manage")

    try {
      const existingProductBundle = await this.productBundlesRepository.findById(id)

      if (!existingProductBundle) {
        throw new ProductBundleNotFoundError()
      }

      const mergedComposition = {
        cupId: input.cupId === undefined ? existingProductBundle.cupId : input.cupId,
        lidId: input.lidId === undefined ? existingProductBundle.lidId : input.lidId,
        cupQtyPerSet:
          input.cupQtyPerSet === undefined
            ? existingProductBundle.cupQtyPerSet
            : input.cupQtyPerSet,
        lidQtyPerSet:
          input.lidQtyPerSet === undefined
            ? existingProductBundle.lidQtyPerSet
            : input.lidQtyPerSet,
      }

      assertValidProductBundleComposition(mergedComposition)

      const productBundle = await this.productBundlesRepository.update(id, {
        ...input,
        ...mergedComposition,
      })

      if (!productBundle) {
        throw new ProductBundleNotFoundError()
      }

      return toProductBundleDto(productBundle)
    } catch (error) {
      if (
        error instanceof AuthorizationError ||
        error instanceof ProductBundleNotFoundError ||
        error instanceof ProductBundlePersistenceValidationError
      ) {
        throw error
      }

      if (isUniqueViolation(error)) {
        throw new DuplicateProductBundleNameError()
      }

      const persistenceValidationError = toProductBundlePersistenceValidationError(error)
      if (persistenceValidationError) {
        throw persistenceValidationError
      }

      throw error
    }
  }
}

function assertValidProductBundleComposition(input: {
  cupId: string | null
  lidId: string | null
  cupQtyPerSet: number
  lidQtyPerSet: number
}) {
  if (!input.cupId && !input.lidId) {
    throw new ProductBundlePersistenceValidationError(
      "At least one cup or lid component is required.",
    )
  }

  if (!input.cupId && input.cupQtyPerSet !== 0) {
    throw new ProductBundlePersistenceValidationError(
      "Cup quantity must be 0 when no cup is selected.",
    )
  }

  if (input.cupId && input.cupQtyPerSet <= 0) {
    throw new ProductBundlePersistenceValidationError(
      "Cup quantity must be greater than 0 when a cup is selected.",
    )
  }

  if (!input.lidId && input.lidQtyPerSet !== 0) {
    throw new ProductBundlePersistenceValidationError(
      "Lid quantity must be 0 when no lid is selected.",
    )
  }

  if (input.lidId && input.lidQtyPerSet <= 0) {
    throw new ProductBundlePersistenceValidationError(
      "Lid quantity must be greater than 0 when a lid is selected.",
    )
  }
}

function isUniqueViolation(error: unknown): boolean {
  return getDbErrorCode(error) === "23505"
}

function toProductBundlePersistenceValidationError(
  error: unknown,
): ProductBundlePersistenceValidationError | null {
  const code = getDbErrorCode(error)
  const detail = getDbErrorDetail(error)
  const message = getDbErrorMessage(error)

  if (code === "23503") {
    return new ProductBundlePersistenceValidationError(
      detail || message || "Product bundle references a cup or lid that does not exist.",
    )
  }

  if (code === "23514" || code === "23502" || code === "22P02") {
    return new ProductBundlePersistenceValidationError(
      detail || message || "Product bundle data failed database validation.",
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
