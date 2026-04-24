import type { NonStockItem } from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { shapePermissionAwareResponse } from "../auth/role-safe-response.js"

export interface AdminNonStockItemDto {
  id: string
  name: string
  description: string | null
  cost_price: string | null
  default_sell_price: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type StaffNonStockItemDto = Omit<
  AdminNonStockItemDto,
  "cost_price" | "default_sell_price"
>

export type NonStockItemDto = AdminNonStockItemDto | StaffNonStockItemDto

export function toNonStockItemDto(
  nonStockItem: NonStockItem,
  user: Pick<SafeUser, "role" | "permissions">,
): NonStockItemDto {
  return shapePermissionAwareResponse(user, "catalog.pricing.view", {
    allowed: () => toAdminNonStockItemDto(nonStockItem),
    restricted: () => toStaffNonStockItemDto(nonStockItem),
  })
}

function toAdminNonStockItemDto(nonStockItem: NonStockItem): AdminNonStockItemDto {
  return {
    id: nonStockItem.id,
    name: nonStockItem.name,
    description: nonStockItem.description ?? null,
    cost_price: nonStockItem.costPrice ?? null,
    default_sell_price: nonStockItem.defaultSellPrice,
    is_active: nonStockItem.isActive,
    created_at: nonStockItem.createdAt.toISOString(),
    updated_at: nonStockItem.updatedAt.toISOString(),
  }
}

function toStaffNonStockItemDto(nonStockItem: NonStockItem): StaffNonStockItemDto {
  const { cost_price, default_sell_price, ...staffDto } = toAdminNonStockItemDto(nonStockItem)

  void cost_price
  void default_sell_price

  return staffDto
}
