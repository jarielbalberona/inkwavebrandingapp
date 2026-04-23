import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

export const cupSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  brand: z.string(),
  size: z.string(),
  dimension: z.string(),
  material: z.string().nullable(),
  color: z.string().nullable(),
  min_stock: z.number(),
  cost_price: z.string().optional(),
  default_sell_price: z.string().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const cupsResponseSchema = z.object({ cups: z.array(cupSchema) })
const cupResponseSchema = z.object({ cup: cupSchema })

export type Cup = z.infer<typeof cupSchema>

export interface CupPayload {
  sku: string
  brand: string
  size: string
  dimension: string
  material?: string
  color?: string
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

async function sendCupRequest(path: string, method: "POST" | "PATCH", payload: CupPayload) {
  try {
    return method === "POST"
      ? await api.post<unknown, typeof payload>(path, payload)
      : await api.patch<unknown, typeof payload>(path, payload)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 409) {
      throw new CupsApiError("SKU already exists. Use a different SKU.", error.status)
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw new CupsApiError("Only admins can change cup catalog records.", error.status)
    }

    if (error instanceof ApiClientError) {
      throw new CupsApiError("Unable to save cup", error.status)
    }

    throw error
  }
}
