import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

export const lidSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  type: z.enum(["paper", "plastic"]),
  brand: z.enum(["dabba", "grecoopack", "china_supplier", "other_supplier"]),
  diameter: z.enum(["80mm", "90mm", "95mm", "98mm"]),
  shape: z.enum(["dome", "flat", "strawless", "coffee_lid", "tall_lid"]),
  color: z.enum(["transparent", "black", "white"]),
  cost_price: z.string().optional(),
  default_sell_price: z.string().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const lidsResponseSchema = z.object({ lids: z.array(lidSchema) })
const lidResponseSchema = z.object({ lid: lidSchema })

export type Lid = z.infer<typeof lidSchema>

export interface LidPayload {
  type: "paper" | "plastic"
  brand: "dabba" | "grecoopack" | "china_supplier" | "other_supplier"
  diameter: "80mm" | "90mm" | "95mm" | "98mm"
  shape: "dome" | "flat" | "strawless" | "coffee_lid" | "tall_lid"
  color: "transparent" | "black" | "white"
  cost_price: string
  default_sell_price: string
  is_active: boolean
}

export class LidsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function listLids(): Promise<Lid[]> {
  try {
    const response = await api.get<unknown>("/lids?include_inactive=true")
    return lidsResponseSchema.parse(response).lids
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new LidsApiError("Unable to load lids.", error.status)
    }

    throw error
  }
}

export async function createLid(payload: LidPayload): Promise<Lid> {
  const response = await sendLidRequest("/lids", "POST", payload)
  return lidResponseSchema.parse(response).lid
}

export async function updateLid(id: string, payload: Partial<LidPayload>): Promise<Lid> {
  const response = await sendLidRequest(`/lids/${id}`, "PATCH", payload)
  return lidResponseSchema.parse(response).lid
}

async function sendLidRequest(
  path: string,
  method: "POST" | "PATCH",
  payload: LidPayload | Partial<LidPayload>,
) {
  try {
    return method === "POST"
      ? await api.post<unknown, typeof payload>(path, payload)
      : await api.patch<unknown, typeof payload>(path, payload)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 400) {
      throw new LidsApiError("Check the lid fields and try again.", error.status)
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw new LidsApiError("Only admins can change lid records.", error.status)
    }

    if (error instanceof ApiClientError && error.status === 404) {
      throw new LidsApiError("Lid no longer exists.", error.status)
    }

    if (error instanceof ApiClientError && error.status === 409) {
      throw new LidsApiError(
        error.message.includes("historical records")
          ? error.message
          : "Lid SKU already exists for that contract combination.",
        error.status,
      )
    }

    if (error instanceof ApiClientError) {
      throw new LidsApiError("Unable to save lid.", error.status)
    }

    throw error
  }
}
