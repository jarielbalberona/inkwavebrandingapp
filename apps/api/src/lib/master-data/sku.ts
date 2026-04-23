import type { CupContractShape } from "../../modules/cups/cups.contract.js"
import type { LidContractShape } from "../../modules/lids/lids.contract.js"

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,79}$/

const cupSizeCodes: Record<CupContractShape["size"], string> = {
  "6.5oz": "6.5",
  "8oz": "8",
  "12oz": "12",
  "16oz": "16",
  "20oz": "20",
  "22oz": "22",
}

const cupTypeCodes: Record<CupContractShape["type"], string> = {
  paper: "PPR",
  plastic: "PLSTC",
}

const cupBrandCodes: Record<CupContractShape["brand"], string> = {
  dabba: "DBBA",
  grecoopack: "GRCPCK",
  china_supplier: "CHNSPLR",
  other_supplier: "OTHSPLR",
}

const cupColorCodes: Record<CupContractShape["color"], string> = {
  transparent: "TRNSPRNT",
  black: "BLCK",
  white: "WHT",
  kraft: "KRFT",
}

const lidDiameterCodes: Record<LidContractShape["diameter"], string> = {
  "80mm": "80",
  "90mm": "90",
  "95mm": "95",
  "98mm": "98",
}

const lidBrandCodes: Record<LidContractShape["brand"], string> = {
  dabba: "DBBA",
  grecoopack: "GRCPCK",
  china_supplier: "CHNSPLR",
  other_supplier: "OTHSPLR",
}

const lidShapeCodes: Record<LidContractShape["shape"], string> = {
  dome: "DM",
  flat: "FLT",
  strawless: "STRWLS",
  coffee_lid: "CFFLD",
  tall_lid: "TLLD",
}

const lidColorCodes: Record<LidContractShape["color"], string> = {
  transparent: "TRNSPRNT",
  black: "BLCK",
  white: "WHT",
}

export type CupSkuInput = Pick<CupContractShape, "size" | "type" | "brand" | "color">
export type LidSkuInput = Pick<LidContractShape, "diameter" | "brand" | "shape" | "color">

export function normalizeSku(value: string): string {
  return value.trim().replace(/\s+/g, "-").toUpperCase()
}

export function generateCupSku(input: CupSkuInput): string {
  return normalizeSku(
    [
      cupSizeCodes[input.size],
      cupTypeCodes[input.type],
      cupBrandCodes[input.brand],
      cupColorCodes[input.color],
    ].join("-"),
  )
}

export function generateLidSku(input: LidSkuInput): string {
  const segments = [
    lidDiameterCodes[input.diameter],
    lidBrandCodes[input.brand],
    lidShapeCodes[input.shape],
  ]

  if (shouldIncludeLidColorInSku(input)) {
    segments.push(lidColorCodes[input.color])
  }

  return normalizeSku(segments.join("-"))
}

export function wouldRegenerateCupSku(current: CupSkuInput, next: Partial<CupSkuInput>): boolean {
  return generateCupSku(current) !== generateCupSku({
    ...current,
    ...next,
  })
}

export function wouldRegenerateLidSku(current: LidSkuInput, next: Partial<LidSkuInput>): boolean {
  return generateLidSku(current) !== generateLidSku({
    ...current,
    ...next,
  })
}

function shouldIncludeLidColorInSku(input: LidSkuInput): boolean {
  return input.color !== "transparent"
}
