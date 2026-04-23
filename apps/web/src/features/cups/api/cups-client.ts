import { z } from "zod"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

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
  const response = await fetch(`${apiBaseUrl}/cups?include_inactive=true`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new CupsApiError("Unable to load cups", response.status)
  }

  return cupsResponseSchema.parse(await response.json()).cups
}

export async function createCup(payload: CupPayload): Promise<Cup> {
  const response = await sendCupRequest("/cups", "POST", payload)

  return cupResponseSchema.parse(await response.json()).cup
}

export async function updateCup(id: string, payload: CupPayload): Promise<Cup> {
  const response = await sendCupRequest(`/cups/${id}`, "PATCH", payload)

  return cupResponseSchema.parse(await response.json()).cup
}

async function sendCupRequest(path: string, method: "POST" | "PATCH", payload: CupPayload) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 409) {
    throw new CupsApiError("SKU already exists. Use a different SKU.", response.status)
  }

  if (response.status === 403) {
    throw new CupsApiError("Only admins can change cup catalog records.", response.status)
  }

  if (!response.ok) {
    throw new CupsApiError("Unable to save cup", response.status)
  }

  return response
}
