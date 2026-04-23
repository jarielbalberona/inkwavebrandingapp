export const inventoryMovementTypes = [
  "stock_in",
  "reserve",
  "release_reservation",
  "consume",
  "adjustment_in",
  "adjustment_out",
] as const

export type InventoryMovementType = (typeof inventoryMovementTypes)[number]

export interface InventoryBalanceDelta {
  onHand: number
  reserved: number
}

export const inventoryMovementDeltas: Record<InventoryMovementType, InventoryBalanceDelta> = {
  stock_in: { onHand: 1, reserved: 0 },
  reserve: { onHand: 0, reserved: 1 },
  release_reservation: { onHand: 0, reserved: -1 },
  consume: { onHand: -1, reserved: -1 },
  adjustment_in: { onHand: 1, reserved: 0 },
  adjustment_out: { onHand: -1, reserved: 0 },
}

export function getMovementDelta(type: InventoryMovementType, quantity: number): InventoryBalanceDelta {
  const delta = inventoryMovementDeltas[type]

  return {
    onHand: delta.onHand * quantity,
    reserved: delta.reserved * quantity,
  }
}

export function calculateAvailable(onHand: number, reserved: number): number {
  return onHand - reserved
}
