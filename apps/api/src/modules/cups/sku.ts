import { z } from "zod"

import { normalizeSku, SKU_PATTERN } from "../../lib/master-data/sku.js"

export { normalizeSku, SKU_PATTERN } from "../../lib/master-data/sku.js"

export const skuSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform(normalizeSku)
  .refine((value) => SKU_PATTERN.test(value), {
    message: "SKU may only contain uppercase letters, numbers, hyphens, and underscores",
  })
