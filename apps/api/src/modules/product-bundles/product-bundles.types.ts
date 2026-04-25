import type { ProductBundle } from "../../db/schema/index.js"

export interface ProductBundleDto {
  id: string
  name: string
  description: string | null
  cup_id: string | null
  lid_id: string | null
  cup_qty_per_set: number
  lid_qty_per_set: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export function toProductBundleDto(productBundle: ProductBundle): ProductBundleDto {
  return {
    id: productBundle.id,
    name: productBundle.name,
    description: productBundle.description ?? null,
    cup_id: productBundle.cupId ?? null,
    lid_id: productBundle.lidId ?? null,
    cup_qty_per_set: productBundle.cupQtyPerSet,
    lid_qty_per_set: productBundle.lidQtyPerSet,
    is_active: productBundle.isActive,
    created_at: productBundle.createdAt.toISOString(),
    updated_at: productBundle.updatedAt.toISOString(),
  }
}
