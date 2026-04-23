import type { InventoryBalanceSummary } from "../inventory/inventory.repository.js"
import { calculateAvailable } from "../inventory/inventory.rules.js"
import type { CupUsageReportQuery } from "./reports.schemas.js"
import type { SalesCostVisibilityReportQuery } from "./reports.schemas.js"

export interface InventoryReportItemDto {
  cup: {
    id: string
    sku: string
    type: string
    brand: string
    diameter: string
    size: string
    color: string
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

export interface CupUsageReportItemDto {
  cup: {
    id: string
    sku: string
    type: string
    brand: string
    diameter: string
    size: string
    color: string
    is_active: boolean
  }
  consumed_quantity: number
}

export interface CupUsageReportDto {
  filters: {
    start_date: string | null
    end_date: string | null
  }
  items: CupUsageReportItemDto[]
  total_consumed_quantity: number
}

export interface SalesCostVisibilityReportItemDto {
  cup: {
    id: string
    sku: string
    type: string
    brand: string
    diameter: string
    size: string
    color: string
    is_active: boolean
  }
  released_quantity: number
  sell_total: string
  cost_total: string
  gross_profit: string
}

export interface SalesCostVisibilityReportDto {
  quantity_basis: "released"
  date_basis: "event_date"
  filters: {
    start_date: string | null
    end_date: string | null
  }
  items: SalesCostVisibilityReportItemDto[]
  totals: {
    released_quantity: number
    sell_total: string
    cost_total: string
    gross_profit: string
  }
}

export function toInventoryReportItemDto(
  balance: InventoryBalanceSummary,
): InventoryReportItemDto {
  if (balance.itemType !== "cup") {
    throw new Error("Inventory reports currently operate on cup balances only")
  }

  const available = calculateAvailable(balance.onHand, balance.reserved)

  return {
    cup: {
      id: balance.cup.id,
      sku: balance.cup.sku,
      type: balance.cup.type,
      brand: balance.cup.brand,
      diameter: balance.cup.diameter,
      size: balance.cup.size,
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

export function toCupUsageReportDto(
  query: CupUsageReportQuery,
  items: CupUsageReportItemDto[],
): CupUsageReportDto {
  return {
    filters: {
      start_date: query.start_date?.toISOString() ?? null,
      end_date: query.end_date?.toISOString() ?? null,
    },
    items,
    total_consumed_quantity: items.reduce((total, item) => total + item.consumed_quantity, 0),
  }
}

export function toSalesCostVisibilityReportDto(
  query: SalesCostVisibilityReportQuery,
  items: SalesCostVisibilityReportItemDto[],
): SalesCostVisibilityReportDto {
  const totals = items.reduce(
    (accumulator, item) => ({
      released_quantity: accumulator.released_quantity + item.released_quantity,
      sell_total: addMoneyStrings(accumulator.sell_total, item.sell_total),
      cost_total: addMoneyStrings(accumulator.cost_total, item.cost_total),
      gross_profit: addMoneyStrings(accumulator.gross_profit, item.gross_profit),
    }),
    {
      released_quantity: 0,
      sell_total: "0.00",
      cost_total: "0.00",
      gross_profit: "0.00",
    },
  )

  return {
    quantity_basis: "released",
    date_basis: "event_date",
    filters: {
      start_date: query.start_date?.toISOString() ?? null,
      end_date: query.end_date?.toISOString() ?? null,
    },
    items,
    totals,
  }
}

function addMoneyStrings(left: string, right: string): string {
  return (Number(left) + Number(right)).toFixed(2)
}
