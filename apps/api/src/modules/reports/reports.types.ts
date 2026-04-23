import type { InventoryBalanceSummary } from "../inventory/inventory.repository.js"
import { calculateAvailable } from "../inventory/inventory.rules.js"

export interface InventoryReportItemDto {
  cup: {
    id: string
    sku: string
    brand: string
    size: string
    dimension: string
    material: string | null
    color: string | null
    min_stock: number
    is_active: boolean
  }
  on_hand: number
  reserved: number
  available: number
  is_low_stock: boolean
}

export interface InventoryReportDto {
  low_stock_basis: "available"
  items: InventoryReportItemDto[]
}

export const orderReportStatuses = [
  "pending",
  "in_progress",
  "partial_released",
  "completed",
  "canceled",
] as const

export type OrderReportStatus = (typeof orderReportStatuses)[number]

export interface OrderStatusReportItemDto {
  status: OrderReportStatus
  count: number
}

export interface OrderStatusReportDto {
  statuses: OrderStatusReportItemDto[]
  total_orders: number
}

export function toInventoryReportItemDto(
  balance: InventoryBalanceSummary,
): InventoryReportItemDto {
  const available = calculateAvailable(balance.onHand, balance.reserved)

  return {
    cup: {
      id: balance.cup.id,
      sku: balance.cup.sku,
      brand: balance.cup.brand,
      size: balance.cup.size,
      dimension: balance.cup.dimension,
      material: balance.cup.material,
      color: balance.cup.color,
      min_stock: balance.cup.minStock,
      is_active: balance.cup.isActive,
    },
    on_hand: balance.onHand,
    reserved: balance.reserved,
    available,
    is_low_stock: available <= balance.cup.minStock,
  }
}
