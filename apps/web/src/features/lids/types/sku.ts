const lidBrandCodes = {
  dabba: "DBBA",
  grecoopack: "GRCPCK",
  brand_1: "BRND1",
  other_supplier: "OTHSPLR",
} as const

const lidColorCodes = {
  transparent: "TRNSPRNT",
  black: "BLCK",
  white: "WHT",
} as const

export interface LidSkuPreviewInput {
  diameter: "80mm" | "90mm" | "95mm" | "98mm"
  brand: keyof typeof lidBrandCodes
  shape: "dome" | "flat" | "strawless" | "coffee_lid" | "tall_lid"
  color: keyof typeof lidColorCodes
}

export function generateLidSkuPreview(input: LidSkuPreviewInput): string {
  const segments: string[] = [
    input.diameter,
    lidBrandCodes[input.brand],
    input.shape,
  ]

  if (input.color !== "transparent") {
    segments.push(lidColorCodes[input.color])
  }

  return segments.join("-").trim().replace(/\s+/g, "-").toUpperCase()
}
