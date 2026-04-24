import type { Lid } from "../../db/schema/index.js"
import { generateLidSku } from "../../lib/master-data/sku.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { assertNoStaffRestrictedKeys, shapeRoleAwareResponse } from "../auth/role-safe-response.js"

export interface AdminLidDto {
  id: string
  sku: string
  type: string
  brand: string
  diameter: string
  shape: string
  color: string
  cost_price: string
  default_sell_price: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type StaffLidDto = Omit<AdminLidDto, "cost_price" | "default_sell_price">

export type LidDto = AdminLidDto | StaffLidDto

export function toLidDto(lid: Lid, user: Pick<SafeUser, "role">): LidDto {
  const dto = shapeRoleAwareResponse(user, {
    admin: () => toAdminLidDto(lid),
    staff: () => toStaffLidDto(lid),
  })

  if (user.role === "staff") {
    assertNoStaffRestrictedKeys(dto)
  }

  return dto
}

function toAdminLidDto(lid: Lid): AdminLidDto {
  return {
    id: lid.id,
    sku: resolveLidSku(lid),
    type: lid.type,
    brand: lid.brand,
    diameter: lid.diameter,
    shape: lid.shape,
    color: lid.color,
    cost_price: lid.costPrice,
    default_sell_price: lid.defaultSellPrice,
    is_active: lid.isActive,
    created_at: lid.createdAt.toISOString(),
    updated_at: lid.updatedAt.toISOString(),
  }
}

function resolveLidSku(lid: Lid): string {
  return generateLidSku({
    diameter: lid.diameter,
    brand: lid.brand,
    shape: lid.shape,
    color: lid.color,
  })
}

function toStaffLidDto(lid: Lid): StaffLidDto {
  const { cost_price, default_sell_price, ...staffDto } = toAdminLidDto(lid)

  void cost_price
  void default_sell_price

  return staffDto
}
