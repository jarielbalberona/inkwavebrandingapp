const lidDiameterCodes = {
  "80mm": "80",
  "90mm": "90",
  "95mm": "95",
  "98mm": "98",
} as const

const lidBrandCodes = {
  dabba: "DBBA",
  grecoopack: "GRCPCK",
  china_supplier: "CHNSPLR",
  other_supplier: "OTHSPLR",
} as const

const lidColorCodes = {
  transparent: "TRNSPRNT",
  black: "BLCK",
  white: "WHT",
} as const

export interface LidSkuPreviewInput {
  diameter: keyof typeof lidDiameterCodes
  brand: keyof typeof lidBrandCodes
  shape: "dome" | "flat" | "strawless" | "coffee_lid" | "tall_lid"
  color: keyof typeof lidColorCodes
}

export function generateLidSkuPreview(input: LidSkuPreviewInput): string {
  const segments: string[] = [
    lidDiameterCodes[input.diameter],
    lidBrandCodes[input.brand],
    input.shape,
  ]

  if (input.color !== "transparent") {
    segments.push(lidColorCodes[input.color])
  }

  return segments.join("-").trim().replace(/\s+/g, "-").toUpperCase()
}
