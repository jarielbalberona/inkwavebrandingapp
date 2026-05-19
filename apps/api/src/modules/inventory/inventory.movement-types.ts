import type { SafeUser } from "../auth/auth.schemas.js"
import { toCupDto, type CupDto } from "../cups/cups.types.js"
import { toLidDto, type LidDto } from "../lids/lids.types.js"
import type { InventoryMovementWithRelations } from "./inventory.repository.js"

type InventoryMovementLinkedOrderDto = {
  id: string
  order_number: string
  status: string
  archived_at: string | null
  created_at: string
  order_item: {
    id: string
    item_type: string
    description_snapshot: string
    quantity: number
  } | null
}

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
      linked_order: InventoryMovementLinkedOrderDto | null
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
      linked_order: InventoryMovementLinkedOrderDto | null
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
  user: Pick<SafeUser, "role" | "permissions">
): InventoryMovementDto {
  const createdBy = movement.createdByUser
    ? {
        id: movement.createdByUser.id,
        display_name: movement.createdByUser.displayName,
        email: movement.createdByUser.email,
      }
    : null
  const linkedOrder = toLinkedOrderDto(movement)

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
      linked_order: linkedOrder,
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
    linked_order: linkedOrder,
    created_at: movement.createdAt.toISOString(),
    cup: null,
    lid: toLidDto(movement.lid, user),
    created_by: createdBy,
  }
}

function toLinkedOrderDto(
  movement: InventoryMovementWithRelations
): InventoryMovementLinkedOrderDto | null {
  if (!movement.linkedOrder) {
    return null
  }

  return {
    id: movement.linkedOrder.order.id,
    order_number: movement.linkedOrder.order.orderNumber,
    status: movement.linkedOrder.order.status,
    archived_at: movement.linkedOrder.order.archivedAt?.toISOString() ?? null,
    created_at: movement.linkedOrder.order.createdAt.toISOString(),
    order_item: movement.linkedOrder.orderItem
      ? {
          id: movement.linkedOrder.orderItem.id,
          item_type: movement.linkedOrder.orderItem.itemType,
          description_snapshot:
            movement.linkedOrder.orderItem.descriptionSnapshot,
          quantity: movement.linkedOrder.orderItem.quantity,
        }
      : null,
  }
}
