import type { SafeUser } from "../auth/auth.schemas.js"
import { toCupDto, type CupDto } from "../cups/cups.types.js"
import type { InventoryMovementWithRelations } from "./inventory.repository.js"

export interface InventoryMovementDto {
  id: string
  movement_type: InventoryMovementWithRelations["movementType"]
  quantity: number
  note: string | null
  reference: string | null
  order_id: string | null
  order_item_id: string | null
  created_at: string
  cup: CupDto
  created_by: {
    id: string
    display_name: string | null
    email: string
  } | null
}

export function toInventoryMovementDto(
  movement: InventoryMovementWithRelations,
  user: Pick<SafeUser, "role">,
): InventoryMovementDto {
  return {
    id: movement.id,
    movement_type: movement.movementType,
    quantity: movement.quantity,
    note: movement.note,
    reference: movement.reference,
    order_id: movement.orderId,
    order_item_id: movement.orderItemId,
    created_at: movement.createdAt.toISOString(),
    cup: toCupDto(movement.cup, user),
    created_by: movement.createdByUser
      ? {
          id: movement.createdByUser.id,
          display_name: movement.createdByUser.displayName,
          email: movement.createdByUser.email,
        }
      : null,
  }
}
