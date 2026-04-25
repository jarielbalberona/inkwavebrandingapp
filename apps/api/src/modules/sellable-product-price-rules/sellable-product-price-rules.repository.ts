import { and, asc, eq } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  sellableProductPriceRules,
  type SellableProductPriceRule,
} from "../../db/schema/index.js"
import type {
  CreateSellableProductPriceRuleInput,
  UpdateSellableProductPriceRuleInput,
} from "./sellable-product-price-rules.schemas.js"

export class SellableProductPriceRulesRepository {
  constructor(private readonly db: DatabaseClient) {}

  async list(
    options: { includeInactive?: boolean; productBundleId?: string } = {},
  ): Promise<SellableProductPriceRule[]> {
    const where = and(
      options.includeInactive ? undefined : eq(sellableProductPriceRules.isActive, true),
      options.productBundleId
        ? eq(sellableProductPriceRules.productBundleId, options.productBundleId)
        : undefined,
    )

    return this.db
      .select()
      .from(sellableProductPriceRules)
      .where(where)
      .orderBy(
        asc(sellableProductPriceRules.productBundleId),
        asc(sellableProductPriceRules.minQty),
      )
  }

  async findById(id: string): Promise<SellableProductPriceRule | undefined> {
    const rows = await this.db
      .select()
      .from(sellableProductPriceRules)
      .where(eq(sellableProductPriceRules.id, id))
      .limit(1)

    return rows[0]
  }

  async create(input: CreateSellableProductPriceRuleInput): Promise<SellableProductPriceRule> {
    const rows = await this.db.insert(sellableProductPriceRules).values(input).returning()
    return requirePriceRule(rows[0], "Failed to create sellable product price rule")
  }

  async update(
    id: string,
    input: UpdateSellableProductPriceRuleInput,
  ): Promise<SellableProductPriceRule | undefined> {
    const rows = await this.db
      .update(sellableProductPriceRules)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(sellableProductPriceRules.id, id))
      .returning()

    return rows[0]
  }
}

function requirePriceRule(
  priceRule: SellableProductPriceRule | undefined,
  message: string,
): SellableProductPriceRule {
  if (!priceRule) {
    throw new Error(message)
  }

  return priceRule
}
