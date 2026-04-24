import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

export const cupSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  type: z.enum(["paper", "plastic"]),
  brand: z.enum(["dabba", "grecoopack", "brand_1", "other_supplier"]),
  diameter: z.enum(["80mm", "90mm", "95mm", "98mm"]),
  size: z.enum(["6.5oz", "8oz", "12oz", "16oz", "20oz", "22oz"]),
  color: z.enum(["transparent", "black", "white", "kraft"]),
  min_stock: z.number(),
  cost_price: z.string().optional(),
  default_sell_price: z.string().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const cupsResponseSchema = z.object({ cups: z.array(cupSchema) })
const cupResponseSchema = z.object({ cup: cupSchema })
const cupRequestErrorSchema = z.object({
  error: z.string(),
  details: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
})

export type Cup = z.infer<typeof cupSchema>

export interface CupPayload {
  type: "paper" | "plastic"
  brand: "dabba" | "grecoopack" | "brand_1" | "other_supplier"
  diameter: "80mm" | "90mm" | "95mm" | "98mm"
  size: "6.5oz" | "8oz" | "12oz" | "16oz" | "20oz" | "22oz"
  color: "transparent" | "black" | "white" | "kraft"
  min_stock: number
  cost_price: string
  default_sell_price: string
  is_active: boolean
}

export class CupsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function listCups(): Promise<Cup[]> {
  try {
    const response = await api.get<unknown>("/cups?include_inactive=true")
    return cupsResponseSchema.parse(response).cups
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new CupsApiError("Unable to load cups", error.status)
    }

    throw error
  }
}

export async function createCup(payload: CupPayload): Promise<Cup> {
  const response = await sendCupRequest("/cups", "POST", payload)
  return cupResponseSchema.parse(response).cup
}

export async function updateCup(id: string, payload: CupPayload): Promise<Cup> {
  const response = await sendCupRequest(`/cups/${id}`, "PATCH", payload)
  return cupResponseSchema.parse(response).cup
}

function formatCupRequestError(data: unknown): string | null {
  const parsed = cupRequestErrorSchema.safeParse(data)

  if (!parsed.success) {
    return null
  }

  const details = parsed.data.details
    ?.map((detail) => (detail.path ? `${detail.path}: ${detail.message}` : detail.message))
    .filter(Boolean)

  if (details?.length) {
    return `${parsed.data.error}. ${details.join(" ")}`
  }

  return parsed.data.error
}

async function sendCupRequest(path: string, method: "POST" | "PATCH", payload: CupPayload) {
  try {
    return method === "POST"
      ? await api.post<unknown, typeof payload>(path, payload)
      : await api.patch<unknown, typeof payload>(path, payload)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 400) {
      throw new CupsApiError(
        formatCupRequestError(error.data) ?? error.message ?? "Invalid cup request.",
        error.status,
      )
    }

    if (error instanceof ApiClientError && error.status === 409) {
      throw new CupsApiError(
        error.message.includes("historical records")
          ? error.message
          : "Cup SKU already exists for that contract combination.",
        error.status,
      )
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw new CupsApiError("You do not have permission to change cup catalog records.", error.status)
    }

    if (error instanceof ApiClientError) {
      throw new CupsApiError("Unable to save cup", error.status)
    }

    throw error
  }
}
