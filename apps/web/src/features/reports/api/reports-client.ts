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

export type InventoryReportItem = z.infer<typeof inventoryReportItemSchema>
export type InventoryReport = z.infer<typeof inventoryReportSchema>

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
