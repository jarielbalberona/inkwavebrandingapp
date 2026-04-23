import { z } from "zod"

import { ApiClientError, api, skipErrorToast } from "@/lib/api"

const dashboardOrderStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "partial_released", "completed", "canceled"]),
  count: z.number(),
})

const dashboardSummarySchema = z.object({
  inventory: z.object({
    tracked_cups: z.number(),
    low_stock_count: z.number(),
  }),
  orders: z.object({
    statuses: z.array(dashboardOrderStatusSchema),
    total_orders: z.number(),
    pending_count: z.number(),
    partial_released_count: z.number(),
  }),
})

const dashboardSummaryResponseSchema = z.object({
  summary: dashboardSummarySchema,
})

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
export type DashboardOrderStatusCount = z.infer<typeof dashboardOrderStatusSchema>

export class DashboardApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    const response = await api.get<unknown>("/dashboard/summary", {
      meta: skipErrorToast(),
    })

    return dashboardSummaryResponseSchema.parse(response).summary
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 401) {
        throw new DashboardApiError("You must be signed in to view the dashboard.", error.status)
      }

      throw new DashboardApiError("Unable to load dashboard summary.", error.status)
    }

    throw error
  }
}
