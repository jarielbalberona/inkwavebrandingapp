import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

export const sellableProductPriceRuleSchema = z.object({
  id: z.string().uuid(),
  product_bundle_id: z.string().uuid(),
  min_qty: z.number(),
  max_qty: z.number().nullable(),
  unit_price: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const sellableProductPriceRulesResponseSchema = z.object({
  sellable_product_price_rules: z.array(sellableProductPriceRuleSchema),
})

const sellableProductPriceRuleResponseSchema = z.object({
  sellable_product_price_rule: sellableProductPriceRuleSchema,
})

const sellableProductPriceRuleRequestErrorSchema = z.object({
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

export type SellableProductPriceRule = z.infer<typeof sellableProductPriceRuleSchema>

export interface SellableProductPriceRulePayload {
  product_bundle_id: string
  min_qty: number
  max_qty?: number | null
  unit_price: string
  is_active: boolean
}

export class SellableProductPriceRulesApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function listSellableProductPriceRules(): Promise<SellableProductPriceRule[]> {
  try {
    const response = await api.get<unknown>("/sellable-product-price-rules?include_inactive=true")
    return sellableProductPriceRulesResponseSchema.parse(response).sellable_product_price_rules
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new SellableProductPriceRulesApiError("Unable to load pricing rules.", error.status)
    }

    throw error
  }
}

export async function createSellableProductPriceRule(
  payload: SellableProductPriceRulePayload,
): Promise<SellableProductPriceRule> {
  const response = await sendSellableProductPriceRuleRequest(
    "/sellable-product-price-rules",
    "POST",
    payload,
  )
  return sellableProductPriceRuleResponseSchema.parse(response).sellable_product_price_rule
}

export async function updateSellableProductPriceRule(
  id: string,
  payload: SellableProductPriceRulePayload,
): Promise<SellableProductPriceRule> {
  const response = await sendSellableProductPriceRuleRequest(
    `/sellable-product-price-rules/${id}`,
    "PATCH",
    payload,
  )
  return sellableProductPriceRuleResponseSchema.parse(response).sellable_product_price_rule
}

function formatSellableProductPriceRuleRequestError(data: unknown): string | null {
  const parsed = sellableProductPriceRuleRequestErrorSchema.safeParse(data)

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

async function sendSellableProductPriceRuleRequest(
  path: string,
  method: "POST" | "PATCH",
  payload: SellableProductPriceRulePayload,
) {
  try {
    return method === "POST"
      ? await api.post<unknown, typeof payload>(path, payload)
      : await api.patch<unknown, typeof payload>(path, payload)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 400) {
      throw new SellableProductPriceRulesApiError(
        formatSellableProductPriceRuleRequestError(error.data) ??
          error.message ??
          "Invalid pricing rule request.",
        error.status,
      )
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw new SellableProductPriceRulesApiError(
        "You do not have permission to change pricing rules.",
        error.status,
      )
    }

    if (error instanceof ApiClientError && error.status === 404) {
      throw new SellableProductPriceRulesApiError("Pricing rule no longer exists.", error.status)
    }

    if (error instanceof ApiClientError) {
      throw new SellableProductPriceRulesApiError("Unable to save pricing rule.", error.status)
    }

    throw error
  }
}
