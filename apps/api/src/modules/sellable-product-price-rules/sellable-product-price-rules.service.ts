import type { ProductBundle, SellableProductPriceRule } from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { assertPermission, AuthorizationError } from "../auth/authorization.js"
import {
  findMatchingActiveRange,
  findOverlappingRange,
} from "./sellable-product-price-rules.ranges.js"
import type {
  CreateSellableProductPriceRuleInput,
  SellableProductPriceRuleDefaultQuery,
  SellableProductPriceRuleListQuery,
  UpdateSellableProductPriceRuleInput,
} from "./sellable-product-price-rules.schemas.js"
import {
  toSellableProductPriceRuleDto,
  type SellableProductPriceRuleDto,
} from "./sellable-product-price-rules.types.js"

interface SellableProductPriceRulesDataStore {
  list(options?: {
    includeInactive?: boolean
    productBundleId?: string
  }): Promise<SellableProductPriceRule[]>
  findById(id: string): Promise<SellableProductPriceRule | undefined>
  listActiveByProductBundle(productBundleId: string): Promise<SellableProductPriceRule[]>
  create(input: CreateSellableProductPriceRuleInput): Promise<SellableProductPriceRule>
  update(
    id: string,
    input: UpdateSellableProductPriceRuleInput,
  ): Promise<SellableProductPriceRule | undefined>
}

interface ProductBundlesDataStore {
  findById(id: string): Promise<ProductBundle | undefined>
}

export class SellableProductPriceRuleNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Sellable product price rule not found")
  }
}

export class SellableProductPriceRuleValidationError extends Error {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
  }
}

export class SellableProductPriceRulesService {
  constructor(
    private readonly priceRulesRepository: SellableProductPriceRulesDataStore,
    private readonly productBundlesRepository: ProductBundlesDataStore,
  ) {}

  async list(
    query: SellableProductPriceRuleListQuery,
    user: SafeUser,
  ): Promise<SellableProductPriceRuleDto[]> {
    assertPermission(user, "sellable_product_price_rules.view")

    const priceRules = await this.priceRulesRepository.list({
      includeInactive: query.include_inactive,
      productBundleId: query.product_bundle_id,
    })

    return priceRules.map(toSellableProductPriceRuleDto)
  }

  async getById(id: string, user: SafeUser): Promise<SellableProductPriceRuleDto> {
    assertPermission(user, "sellable_product_price_rules.view")

    const priceRule = await this.priceRulesRepository.findById(id)

    if (!priceRule) {
      throw new SellableProductPriceRuleNotFoundError()
    }

    return toSellableProductPriceRuleDto(priceRule)
  }

  async resolveDefaultPriceRule(
    query: SellableProductPriceRuleDefaultQuery,
    user: SafeUser,
  ): Promise<SellableProductPriceRuleDto | null> {
    assertPermission(user, "sellable_product_price_rules.view")

    const activeRules = await this.priceRulesRepository.listActiveByProductBundle(
      query.product_bundle_id,
    )

    try {
      const matchingRule = findMatchingActiveRange(query.quantity, activeRules)
      return matchingRule ? toSellableProductPriceRuleDto(matchingRule) : null
    } catch (error) {
      if (error instanceof Error) {
        throw new SellableProductPriceRuleValidationError(error.message)
      }

      throw error
    }
  }

  async create(
    input: CreateSellableProductPriceRuleInput,
    user: SafeUser,
  ): Promise<SellableProductPriceRuleDto> {
    assertPermission(user, "sellable_product_price_rules.manage")

    try {
      await this.assertProductBundleCanReceiveRule(input.productBundleId, input.isActive)
      await this.assertNoActiveRangeOverlap(input)

      return toSellableProductPriceRuleDto(await this.priceRulesRepository.create(input))
    } catch (error) {
      if (error instanceof SellableProductPriceRuleValidationError) {
        throw error
      }

      const persistenceValidationError = toSellableProductPriceRuleValidationError(error)
      if (persistenceValidationError) {
        throw persistenceValidationError
      }

      throw error
    }
  }

  async update(
    id: string,
    input: UpdateSellableProductPriceRuleInput,
    user: SafeUser,
  ): Promise<SellableProductPriceRuleDto> {
    assertPermission(user, "sellable_product_price_rules.manage")

    try {
      const existingPriceRule = await this.priceRulesRepository.findById(id)

      if (!existingPriceRule) {
        throw new SellableProductPriceRuleNotFoundError()
      }

      const merged = {
        productBundleId:
          input.productBundleId === undefined
            ? existingPriceRule.productBundleId
            : input.productBundleId,
        minQty: input.minQty === undefined ? existingPriceRule.minQty : input.minQty,
        maxQty: input.maxQty === undefined ? existingPriceRule.maxQty : input.maxQty,
        isActive: input.isActive === undefined ? existingPriceRule.isActive : input.isActive,
      }

      await this.assertProductBundleCanReceiveRule(merged.productBundleId, merged.isActive)
      await this.assertNoActiveRangeOverlap({
        id,
        productBundleId: merged.productBundleId,
        minQty: merged.minQty,
        maxQty: merged.maxQty,
        isActive: merged.isActive,
      })

      const priceRule = await this.priceRulesRepository.update(id, input)

      if (!priceRule) {
        throw new SellableProductPriceRuleNotFoundError()
      }

      return toSellableProductPriceRuleDto(priceRule)
    } catch (error) {
      if (
        error instanceof AuthorizationError ||
        error instanceof SellableProductPriceRuleNotFoundError ||
        error instanceof SellableProductPriceRuleValidationError
      ) {
        throw error
      }

      const persistenceValidationError = toSellableProductPriceRuleValidationError(error)
      if (persistenceValidationError) {
        throw persistenceValidationError
      }

      throw error
    }
  }

  private async assertProductBundleCanReceiveRule(productBundleId: string, ruleIsActive: boolean) {
    const productBundle = await this.productBundlesRepository.findById(productBundleId)

    if (!productBundle) {
      throw new SellableProductPriceRuleValidationError(
        "Sellable product price rule references a product bundle that does not exist.",
      )
    }

    if (ruleIsActive && !productBundle.isActive) {
      throw new SellableProductPriceRuleValidationError(
        "Active sellable product price rules cannot reference inactive product bundles.",
      )
    }
  }

  private async assertNoActiveRangeOverlap(input: {
    id?: string
    productBundleId: string
    minQty: number
    maxQty?: number | null
    isActive: boolean
  }) {
    if (!input.isActive) {
      return
    }

    const activeRules = await this.priceRulesRepository.listActiveByProductBundle(
      input.productBundleId,
    )
    const overlappingRule = findOverlappingRange(
      {
        id: input.id,
        minQty: input.minQty,
        maxQty: input.maxQty ?? null,
      },
      activeRules,
    )

    if (!overlappingRule) {
      return
    }

    throw new SellableProductPriceRuleValidationError(
      `Active price rule range overlaps existing active rule ${overlappingRule.id}.`,
    )
  }
}

function toSellableProductPriceRuleValidationError(
  error: unknown,
): SellableProductPriceRuleValidationError | null {
  const code = getDbErrorCode(error)
  const detail = getDbErrorDetail(error)
  const message = getDbErrorMessage(error)

  if (code === "23503") {
    return new SellableProductPriceRuleValidationError(
      detail || message || "Sellable product price rule references missing data.",
    )
  }

  if (code === "23514" || code === "23502" || code === "22P02") {
    return new SellableProductPriceRuleValidationError(
      detail || message || "Sellable product price rule failed database validation.",
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
