import type { Cup } from "../../db/schema/index.js"
import { generateCupSku } from "../../lib/master-data/sku.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { shapePermissionAwareResponse } from "../auth/role-safe-response.js"

export interface AdminCupDto {
  id: string
  sku: string
  type: string
  brand: string
  diameter: string
  size: string
  color: string
  min_stock: number
  cost_price: string
  default_sell_price: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type StaffCupDto = Omit<AdminCupDto, "cost_price" | "default_sell_price">

export type CupDto = AdminCupDto | StaffCupDto

export function toCupDto(cup: Cup, user: Pick<SafeUser, "role" | "permissions">): CupDto {
  return shapePermissionAwareResponse(user, "catalog.pricing.view", {
    allowed: () => toAdminCupDto(cup),
    restricted: () => toStaffCupDto(cup),
  })
}

function toAdminCupDto(cup: Cup): AdminCupDto {
  return {
    id: cup.id,
    sku: resolveCupSku(cup),
    type: cup.type,
    brand: cup.brand,
    diameter: cup.diameter,
    size: cup.size,
    color: cup.color,
    min_stock: cup.minStock,
    cost_price: cup.costPrice,
    default_sell_price: cup.defaultSellPrice,
    is_active: cup.isActive,
    created_at: cup.createdAt.toISOString(),
    updated_at: cup.updatedAt.toISOString(),
  }
}

function resolveCupSku(cup: Cup): string {
  return generateCupSku({
    type: cup.type,
    brand: cup.brand,
    size: cup.size,
    color: cup.color,
  })
}

function toStaffCupDto(cup: Cup): StaffCupDto {
  const { cost_price, default_sell_price, ...staffDto } = toAdminCupDto(cup)

  void cost_price
  void default_sell_price

  return staffDto
}
