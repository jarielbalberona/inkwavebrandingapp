import { z } from "zod"

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,79}$/

export function normalizeSku(value: string): string {
  return value.trim().replace(/\s+/g, "-").toUpperCase()
}

export const skuSchema = z
  .string()
  .trim()
  .min(1, "SKU is required")
  .max(80, "SKU must be 80 characters or fewer")
  .transform(normalizeSku)
  .refine((value) => SKU_PATTERN.test(value), {
    message: "Use only letters, numbers, hyphens, or underscores",
  })
