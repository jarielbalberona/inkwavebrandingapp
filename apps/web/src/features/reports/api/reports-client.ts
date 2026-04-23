import { z } from "zod"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

const reportCupSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  brand: z.string(),
  size: z.string(),
  dimension: z.string(),
  material: z.string().nullable(),
  color: z.string().nullable(),
  min_stock: z.number(),
  is_active: z.boolean(),
})

const inventoryReportItemSchema = z.object({
  cup: reportCupSchema,
  on_hand: z.number(),
  reserved: z.number(),
  available: z.number(),
  is_low_stock: z.boolean(),
})

const inventoryReportSchema = z.object({
  low_stock_basis: z.literal("available"),
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
    brand: z.string(),
    size: z.string(),
    dimension: z.string(),
    material: z.string().nullable(),
    color: z.string().nullable(),
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

export type InventoryReportItem = z.infer<typeof inventoryReportItemSchema>
export type InventoryReport = z.infer<typeof inventoryReportSchema>
export type OrderStatusReport = z.infer<typeof orderStatusReportSchema>
export type OrderStatusReportItem = z.infer<typeof orderStatusReportItemSchema>
export type CupUsageReport = z.infer<typeof cupUsageReportSchema>
export type CupUsageReportItem = z.infer<typeof cupUsageReportItemSchema>

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
