import { z } from "zod"

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,79}$/

const cupSizeCodes = {
  "6.5oz": "6.5",
  "8oz": "8",
  "12oz": "12",
  "16oz": "16",
  "20oz": "20",
  "22oz": "22",
} as const

const cupTypeCodes = {
  paper: "PPR",
  plastic: "PLSTC",
} as const

const cupBrandCodes = {
  dabba: "DBBA",
  grecoopack: "GRCPCK",
  china_supplier: "CHNSPLR",
  other_supplier: "OTHSPLR",
} as const

const cupColorCodes = {
  transparent: "TRNSPRNT",
  black: "BLCK",
  white: "WHT",
  kraft: "KRFT",
} as const

export function normalizeSku(value: string): string {
  return value.trim().replace(/\s+/g, "-").toUpperCase()
}

export interface CupSkuPreviewInput {
  type: keyof typeof cupTypeCodes
  brand: keyof typeof cupBrandCodes
  size: keyof typeof cupSizeCodes
  color: keyof typeof cupColorCodes
}

export function generateCupSkuPreview(input: CupSkuPreviewInput): string {
  return normalizeSku(
    [
      cupSizeCodes[input.size],
      cupTypeCodes[input.type],
      cupBrandCodes[input.brand],
      cupColorCodes[input.color],
    ].join("-"),
  )
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
