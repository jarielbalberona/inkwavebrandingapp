import { z } from "zod"

import { getApiBaseUrl } from "@/lib/api-base-url"

const apiBaseUrl = getApiBaseUrl()

const reportInventoryItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  type: z.enum(["paper", "plastic"]),
  brand: z.string(),
  diameter: z.enum(["80mm", "90mm", "95mm", "98mm"]),
  size_or_shape: z.string(),
  color: z.string(),
  min_stock: z.number().nullable(),
  is_active: z.boolean(),
})

const inventoryReportItemSchema = z.object({
  item_type: z.enum(["cup", "lid"]),
  item: reportInventoryItemSchema,
  on_hand: z.number(),
  reserved: z.number(),
  available: z.number(),
  is_low_stock: z.boolean(),
})

const inventoryReportSchema = z.object({
  low_stock_basis: z.literal("available"),
  low_stock_scope: z.literal("cup_min_stock_only"),
  items: z.array(inventoryReportItemSchema),
})

const inventoryReportResponseSchema = z.object({
  report: inventoryReportSchema,
})

const orderStatusSchema = z.enum([
  "pending",
  "in_progress",
  "partial_released",
  "completed",
  "canceled",
])

const orderStatusReportItemSchema = z.object({
  status: orderStatusSchema,
  count: z.number(),
})

const orderStatusReportSchema = z.object({
  statuses: z.array(orderStatusReportItemSchema),
  total_orders: z.number(),
})

const orderStatusReportResponseSchema = z.object({
  report: orderStatusReportSchema,
})

const cupUsageReportItemSchema = z.object({
  cup: z.object({
    id: z.string().uuid(),
    sku: z.string(),
    type: z.enum(["paper", "plastic"]),
    brand: z.string(),
    diameter: z.enum(["80mm", "90mm", "95mm", "98mm"]),
    size: z.string(),
    color: z.enum(["transparent", "black", "white", "kraft"]),
    is_active: z.boolean(),
  }),
  consumed_quantity: z.number(),
})

const cupUsageReportSchema = z.object({
  filters: z.object({
    start_date: z.string().nullable(),
    end_date: z.string().nullable(),
  }),
  items: z.array(cupUsageReportItemSchema),
  total_consumed_quantity: z.number(),
})

const cupUsageReportResponseSchema = z.object({
  report: cupUsageReportSchema,
})

const salesCostReportItemSchema = z.object({
  cup: z.object({
    id: z.string().uuid(),
    sku: z.string(),
    type: z.enum(["paper", "plastic"]),
    brand: z.string(),
    diameter: z.enum(["80mm", "90mm", "95mm", "98mm"]),
    size: z.string(),
    color: z.enum(["transparent", "black", "white", "kraft"]),
    is_active: z.boolean(),
  }),
  released_quantity: z.number(),
  sell_total: z.string(),
  cost_total: z.string(),
  gross_profit: z.string(),
})

const salesCostReportSchema = z.object({
  quantity_basis: z.literal("released"),
  date_basis: z.literal("event_date"),
  filters: z.object({
    start_date: z.string().nullable(),
    end_date: z.string().nullable(),
  }),
  items: z.array(salesCostReportItemSchema),
  totals: z.object({
    released_quantity: z.number(),
    sell_total: z.string(),
    cost_total: z.string(),
    gross_profit: z.string(),
  }),
})

const salesCostReportResponseSchema = z.object({
  report: salesCostReportSchema,
})

const commercialSalesItemTypeSchema = z.enum([
  "product_bundle",
  "cup",
  "lid",
  "non_stock_item",
  "custom_charge",
])

const commercialSalesReportItemSchema = z.object({
  item_type: commercialSalesItemTypeSchema,
  item_id: z.string().uuid().nullable(),
  description_snapshot: z.string(),
  quantity_sold: z.number(),
  revenue: z.string(),
  average_unit_price: z.string(),
  invoice_count: z.number(),
  order_count: z.number(),
})

const commercialSalesReportSchema = z.object({
  revenue_basis: z.literal("invoice_line_snapshots"),
  date_basis: z.literal("invoice_created_at"),
  filters: z.object({
    start_date: z.string().nullable(),
    end_date: z.string().nullable(),
    item_type: commercialSalesItemTypeSchema.nullable(),
    product_bundle_id: z.string().uuid().nullable(),
  }),
  items: z.array(commercialSalesReportItemSchema),
  totals: z.object({
    total_revenue: z.string(),
    total_quantity: z.number(),
    total_invoices: z.number(),
    total_orders: z.number(),
    average_unit_price: z.string(),
  }),
})

const commercialSalesReportResponseSchema = z.object({
  report: commercialSalesReportSchema,
})

export type InventoryReportItem = z.infer<typeof inventoryReportItemSchema>
export type InventoryReport = z.infer<typeof inventoryReportSchema>
export type OrderStatusReport = z.infer<typeof orderStatusReportSchema>
export type OrderStatusReportItem = z.infer<typeof orderStatusReportItemSchema>
export type CupUsageReport = z.infer<typeof cupUsageReportSchema>
export type CupUsageReportItem = z.infer<typeof cupUsageReportItemSchema>
export type SalesCostReport = z.infer<typeof salesCostReportSchema>
export type SalesCostReportItem = z.infer<typeof salesCostReportItemSchema>
export type CommercialSalesReport = z.infer<typeof commercialSalesReportSchema>
export type CommercialSalesReportItem = z.infer<typeof commercialSalesReportItemSchema>

export class ReportsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function getInventorySummaryReport(): Promise<InventoryReport> {
  const response = await fetch(`${apiBaseUrl}/reports/inventory-summary`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new ReportsApiError("Unable to load inventory summary report.", response.status)
  }

  return inventoryReportResponseSchema.parse(await response.json()).report
}

export async function getLowStockReport(): Promise<InventoryReport> {
  const response = await fetch(`${apiBaseUrl}/reports/low-stock`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new ReportsApiError("Unable to load low-stock report.", response.status)
  }

  return inventoryReportResponseSchema.parse(await response.json()).report
}

export async function getOrderStatusReport(): Promise<OrderStatusReport> {
  const response = await fetch(`${apiBaseUrl}/reports/order-status`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new ReportsApiError("Unable to load order status report.", response.status)
  }

  return orderStatusReportResponseSchema.parse(await response.json()).report
}

export async function getCupUsageReport(): Promise<CupUsageReport> {
  const response = await fetch(`${apiBaseUrl}/reports/cup-usage`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new ReportsApiError("Unable to load cup usage report.", response.status)
  }

  return cupUsageReportResponseSchema.parse(await response.json()).report
}

export async function getSalesCostReport(): Promise<SalesCostReport> {
  const response = await fetch(`${apiBaseUrl}/reports/sales-cost-visibility`, {
    credentials: "include",
  })

  if (response.status === 403) {
    throw new ReportsApiError("You do not have permission to view sales and cost reporting.", response.status)
  }

  if (!response.ok) {
    throw new ReportsApiError("Unable to load sales and cost report.", response.status)
  }

  return salesCostReportResponseSchema.parse(await response.json()).report
}

export async function getCommercialSalesReport(): Promise<CommercialSalesReport> {
  const response = await fetch(`${apiBaseUrl}/reports/commercial-sales`, {
    credentials: "include",
  })

  if (response.status === 403) {
    throw new ReportsApiError("You do not have permission to view commercial sales reporting.", response.status)
  }

  if (!response.ok) {
    throw new ReportsApiError("Unable to load commercial sales report.", response.status)
  }

  return commercialSalesReportResponseSchema.parse(await response.json()).report
}
