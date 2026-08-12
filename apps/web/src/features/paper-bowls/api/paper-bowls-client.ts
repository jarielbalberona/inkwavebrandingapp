import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

export const paperBowlSizes = ["220cc", "320cc", "390cc", "520cc", "750cc"] as const
export const paperBowlColors = ["white", "kraft"] as const

export const paperBowlSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  supplier: z.literal("other_supplier"),
  size: z.enum(paperBowlSizes),
  color: z.enum(paperBowlColors),
  diameter_mm: z.number().int().positive().nullable(),
  min_stock: z.number().int().nonnegative(),
  cost_price: z.string().optional(),
  default_sell_price: z.string().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type PaperBowl = z.infer<typeof paperBowlSchema>
export type PaperBowlPayload = {
  size: (typeof paperBowlSizes)[number]
  color: (typeof paperBowlColors)[number]
  diameter_mm: number | null
  min_stock: number
  cost_price: string
  default_sell_price: string
  is_active: boolean
}

const listSchema = z.object({ paper_bowls: z.array(paperBowlSchema) })
const responseSchema = z.object({ paper_bowl: paperBowlSchema })

export async function listPaperBowls(): Promise<PaperBowl[]> {
  return listSchema.parse(await api.get("/paper-bowls?include_inactive=true")).paper_bowls
}

export async function createPaperBowl(payload: PaperBowlPayload): Promise<PaperBowl> {
  return send("/paper-bowls", "POST", payload)
}

export async function updatePaperBowl(
  id: string,
  payload: PaperBowlPayload,
): Promise<PaperBowl> {
  return send(`/paper-bowls/${id}`, "PATCH", payload)
}

async function send(path: string, method: "POST" | "PATCH", payload: PaperBowlPayload) {
  try {
    const result =
      method === "POST"
        ? await api.post<unknown, PaperBowlPayload>(path, payload)
        : await api.patch<unknown, PaperBowlPayload>(path, payload)
    return responseSchema.parse(result).paper_bowl
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new Error(error.message || "Unable to save paper bowl")
    }
    throw error
  }
}
