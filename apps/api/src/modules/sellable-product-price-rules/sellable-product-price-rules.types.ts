import type { SellableProductPriceRule } from "../../db/schema/index.js"

export interface SellableProductPriceRuleDto {
  id: string
  product_bundle_id: string
  min_qty: number
  max_qty: number | null
  unit_price: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export function toSellableProductPriceRuleDto(
  priceRule: SellableProductPriceRule,
): SellableProductPriceRuleDto {
  return {
    id: priceRule.id,
    product_bundle_id: priceRule.productBundleId,
    min_qty: priceRule.minQty,
    max_qty: priceRule.maxQty ?? null,
    unit_price: priceRule.unitPrice,
    is_active: priceRule.isActive,
    created_at: priceRule.createdAt.toISOString(),
    updated_at: priceRule.updatedAt.toISOString(),
  }
}
