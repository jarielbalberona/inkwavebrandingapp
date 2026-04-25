import type { SafeUser } from "../auth/auth.schemas.js"
import { assertPermission, AuthorizationError } from "../auth/authorization.js"
import type { ProductBundle } from "../../db/schema/index.js"
import { getProductBundleCompositionIssues } from "./product-bundles.composition.js"
import type {
  CreateProductBundleInput,
  ProductBundleListQuery,
  UpdateProductBundleInput,
} from "./product-bundles.schemas.js"
import { toProductBundleDto, type ProductBundleDto } from "./product-bundles.types.js"

interface ProductBundlesDataStore {
  list(options?: { includeInactive?: boolean; name?: string }): Promise<ProductBundle[]>
  findById(id: string): Promise<ProductBundle | undefined>
  create(input: CreateProductBundleInput): Promise<ProductBundle>
  update(id: string, input: UpdateProductBundleInput): Promise<ProductBundle | undefined>
}

interface ProductBundleComponentDataStore {
  findById(id: string): Promise<{ isActive: boolean } | undefined>
}

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
  constructor(
    private readonly productBundlesRepository: ProductBundlesDataStore,
    private readonly cupsRepository: ProductBundleComponentDataStore,
    private readonly lidsRepository: ProductBundleComponentDataStore,
  ) {}

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
      await this.assertReferencedComponentsAreActive(input, input.isActive)

      return toProductBundleDto(await this.productBundlesRepository.create(input))
    } catch (error) {
      if (error instanceof ProductBundlePersistenceValidationError) {
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
      await this.assertReferencedComponentsAreActive(
        mergedComposition,
        input.isActive === undefined ? existingProductBundle.isActive : input.isActive,
      )

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

  private async assertReferencedComponentsAreActive(
    input: {
      cupId?: string | null
      lidId?: string | null
    },
    bundleIsActive: boolean,
  ) {
    if (!bundleIsActive) {
      return
    }

    if (input.cupId) {
      const cup = await this.cupsRepository.findById(input.cupId)

      if (!cup) {
        throw new ProductBundlePersistenceValidationError(
          "Product bundle references a cup that does not exist.",
        )
      }

      if (!cup.isActive) {
        throw new ProductBundlePersistenceValidationError(
          "Active product bundles cannot reference inactive cups.",
        )
      }
    }

    if (input.lidId) {
      const lid = await this.lidsRepository.findById(input.lidId)

      if (!lid) {
        throw new ProductBundlePersistenceValidationError(
          "Product bundle references a lid that does not exist.",
        )
      }

      if (!lid.isActive) {
        throw new ProductBundlePersistenceValidationError(
          "Active product bundles cannot reference inactive lids.",
        )
      }
    }
  }
}

function assertValidProductBundleComposition(input: {
  cupId: string | null
  lidId: string | null
  cupQtyPerSet: number
  lidQtyPerSet: number
}) {
  const issues = getProductBundleCompositionIssues(input)

  if (issues.length > 0) {
    throw new ProductBundlePersistenceValidationError(issues.join(" "))
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
