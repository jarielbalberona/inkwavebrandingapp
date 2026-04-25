import { z } from "zod"

import { ApiClientError, api } from "@/lib/api"

export const productBundleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  cup_id: z.string().uuid().nullable(),
  lid_id: z.string().uuid().nullable(),
  cup_qty_per_set: z.number(),
  lid_qty_per_set: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const productBundlesResponseSchema = z.object({
  product_bundles: z.array(productBundleSchema),
})

const productBundleResponseSchema = z.object({
  product_bundle: productBundleSchema,
})

const productBundleRequestErrorSchema = z.object({
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

export type ProductBundle = z.infer<typeof productBundleSchema>

export interface ProductBundlePayload {
  name: string
  description?: string | null
  cup_id?: string | null
  lid_id?: string | null
  cup_qty_per_set: number
  lid_qty_per_set: number
  is_active: boolean
}

export class ProductBundlesApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function listProductBundles(): Promise<ProductBundle[]> {
  try {
    const response = await api.get<unknown>("/product-bundles?include_inactive=true")
    return productBundlesResponseSchema.parse(response).product_bundles
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new ProductBundlesApiError("Unable to load product bundles.", error.status)
    }

    throw error
  }
}

export async function createProductBundle(payload: ProductBundlePayload): Promise<ProductBundle> {
  const response = await sendProductBundleRequest("/product-bundles", "POST", payload)
  return productBundleResponseSchema.parse(response).product_bundle
}

export async function updateProductBundle(
  id: string,
  payload: ProductBundlePayload,
): Promise<ProductBundle> {
  const response = await sendProductBundleRequest(`/product-bundles/${id}`, "PATCH", payload)
  return productBundleResponseSchema.parse(response).product_bundle
}

function formatProductBundleRequestError(data: unknown): string | null {
  const parsed = productBundleRequestErrorSchema.safeParse(data)

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

async function sendProductBundleRequest(
  path: string,
  method: "POST" | "PATCH",
  payload: ProductBundlePayload,
) {
  try {
    return method === "POST"
      ? await api.post<unknown, typeof payload>(path, payload)
      : await api.patch<unknown, typeof payload>(path, payload)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 400) {
      throw new ProductBundlesApiError(
        formatProductBundleRequestError(error.data) ??
          error.message ??
          "Invalid product bundle request.",
        error.status,
      )
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw new ProductBundlesApiError(
        "You do not have permission to change product bundles.",
        error.status,
      )
    }

    if (error instanceof ApiClientError && error.status === 404) {
      throw new ProductBundlesApiError("Product bundle no longer exists.", error.status)
    }

    if (error instanceof ApiClientError && error.status === 409) {
      throw new ProductBundlesApiError("Product bundle name already exists.", error.status)
    }

    if (error instanceof ApiClientError) {
      throw new ProductBundlesApiError("Unable to save product bundle.", error.status)
    }

    throw error
  }
}
