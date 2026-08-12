import type { PaperBowl } from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { shapePermissionAwareResponse } from "../auth/role-safe-response.js"
import { formatPaperBowlName } from "./paper-bowls.contract.js"

export function toPaperBowlDto(
  bowl: PaperBowl,
  user: Pick<SafeUser, "role" | "permissions">,
) {
  const base = {
    id: bowl.id,
    sku: bowl.sku,
    name: formatPaperBowlName(bowl),
    supplier: bowl.supplier,
    size: bowl.size,
    color: bowl.color,
    diameter_mm: bowl.diameterMm,
    min_stock: bowl.minStock,
    is_active: bowl.isActive,
    created_at: bowl.createdAt.toISOString(),
    updated_at: bowl.updatedAt.toISOString(),
  }

  return shapePermissionAwareResponse(user, "catalog.pricing.view", {
    allowed: () => ({
      ...base,
      cost_price: bowl.costPrice,
      default_sell_price: bowl.defaultSellPrice,
    }),
    restricted: () => base,
  })
}
