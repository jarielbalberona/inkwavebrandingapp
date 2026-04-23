import type { SafeUser } from "../auth/auth.schemas.js"
import { toCupDto, type CupDto } from "../cups/cups.types.js"
import { toLidDto, type LidDto } from "../lids/lids.types.js"
import type { InventoryMovementWithRelations } from "./inventory.repository.js"

export type InventoryMovementDto =
  | {
      id: string
      item_type: "cup"
      movement_type: InventoryMovementWithRelations["movementType"]
      quantity: number
      note: string | null
      reference: string | null
      order_id: string | null
      order_item_id: string | null
      created_at: string
      cup: CupDto
      lid: null
      created_by: {
        id: string
        display_name: string | null
        email: string
      } | null
    }
  | {
      id: string
      item_type: "lid"
      movement_type: InventoryMovementWithRelations["movementType"]
      quantity: number
      note: string | null
      reference: string | null
      order_id: string | null
      order_item_id: string | null
      created_at: string
      cup: null
      lid: LidDto
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
  const createdBy = movement.createdByUser
    ? {
        id: movement.createdByUser.id,
        display_name: movement.createdByUser.displayName,
        email: movement.createdByUser.email,
      }
    : null

  if (movement.itemType === "cup") {
    if (!movement.cup) {
      throw new Error("Cup inventory movement is missing cup relation")
    }

    return {
      id: movement.id,
      item_type: "cup",
      movement_type: movement.movementType,
      quantity: movement.quantity,
      note: movement.note,
      reference: movement.reference,
      order_id: movement.orderId,
      order_item_id: movement.orderItemId,
      created_at: movement.createdAt.toISOString(),
      cup: toCupDto(movement.cup, user),
      lid: null,
      created_by: createdBy,
    }
  }

  if (!movement.lid) {
    throw new Error("Lid inventory movement is missing lid relation")
  }

  return {
    id: movement.id,
    item_type: "lid",
    movement_type: movement.movementType,
    quantity: movement.quantity,
    note: movement.note,
    reference: movement.reference,
    order_id: movement.orderId,
    order_item_id: movement.orderItemId,
    created_at: movement.createdAt.toISOString(),
    cup: null,
    lid: toLidDto(movement.lid, user),
    created_by: createdBy,
  }
}
