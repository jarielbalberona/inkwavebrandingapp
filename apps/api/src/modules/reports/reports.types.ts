import type { InventoryBalanceSummary } from "../inventory/inventory.repository.js"
import { calculateAvailable } from "../inventory/inventory.rules.js"
import type { CommercialSalesReportItemType, CommercialSalesReportQuery, CupUsageReportQuery } from "./reports.schemas.js"
import type { SalesCostVisibilityReportQuery } from "./reports.schemas.js"

export interface InventoryReportItemDto {
  item_type: "cup" | "lid"
  item: {
    id: string
    sku: string
    type: string
    brand: string
    diameter: string
    size_or_shape: string
    color: string
    min_stock: number | null
    is_active: boolean
  }
  on_hand: number
  reserved: number
  available: number
  is_low_stock: boolean
}

export interface InventoryReportDto {
  low_stock_basis: "available"
  low_stock_scope: "cup_min_stock_only"
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

export interface CommercialSalesReportItemDto {
  item_type: CommercialSalesReportItemType
  item_id: string | null
  description_snapshot: string
  quantity_sold: number
  revenue: string
  average_unit_price: string
  invoice_count: number
  order_count: number
}

export interface CommercialSalesReportDto {
  revenue_basis: "invoice_line_snapshots"
  date_basis: "invoice_created_at"
  filters: {
    start_date: string | null
    end_date: string | null
    item_type: CommercialSalesReportItemType | null
    product_bundle_id: string | null
  }
  items: CommercialSalesReportItemDto[]
  totals: {
    total_revenue: string
    total_quantity: number
    total_invoices: number
    total_orders: number
    average_unit_price: string
  }
}

export function toInventoryReportItemDto(
  balance: InventoryBalanceSummary,
): InventoryReportItemDto {
  const available = calculateAvailable(balance.onHand, balance.reserved)

  if (balance.itemType === "cup") {
    return {
      item_type: "cup",
      item: {
        id: balance.cup.id,
        sku: balance.cup.sku,
        type: balance.cup.type,
        brand: balance.cup.brand,
        diameter: balance.cup.diameter,
        size_or_shape: balance.cup.size,
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

  return {
    item_type: "lid",
    item: {
      id: balance.lid.id,
      sku: balance.lid.sku,
      type: balance.lid.type,
      brand: balance.lid.brand,
      diameter: balance.lid.diameter,
      size_or_shape: balance.lid.shape,
      color: balance.lid.color,
      min_stock: null,
      is_active: balance.lid.isActive,
    },
    on_hand: balance.onHand,
    reserved: balance.reserved,
    available,
    is_low_stock: false,
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

export function toCommercialSalesReportDto(
  query: CommercialSalesReportQuery,
  items: CommercialSalesReportItemDto[],
  represented: { invoiceCount: number; orderCount: number },
): CommercialSalesReportDto {
  const totals = items.reduce(
    (accumulator, item) => {
      accumulator.total_revenue = addMoneyStrings(accumulator.total_revenue, item.revenue)
      accumulator.total_quantity += item.quantity_sold
      return accumulator
    },
    {
      total_revenue: "0.00",
      total_quantity: 0,
    },
  )

  return {
    revenue_basis: "invoice_line_snapshots",
    date_basis: "invoice_created_at",
    filters: {
      start_date: query.start_date?.toISOString() ?? null,
      end_date: query.end_date?.toISOString() ?? null,
      item_type: query.item_type ?? null,
      product_bundle_id: query.product_bundle_id ?? null,
    },
    items,
    totals: {
      ...totals,
      total_invoices: represented.invoiceCount,
      total_orders: represented.orderCount,
      average_unit_price:
        totals.total_quantity === 0
          ? "0.00"
          : (Number(totals.total_revenue) / totals.total_quantity).toFixed(2),
    },
  }
}

function addMoneyStrings(left: string, right: string): string {
  return (Number(left) + Number(right)).toFixed(2)
}
