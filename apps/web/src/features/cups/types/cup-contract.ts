export const cupTypes = ["paper", "plastic"] as const
export const cupBrands = [
  "dabba",
  "grecoopack",
  "china_supplier",
  "other_supplier",
] as const
export const cupDiameters = ["80mm", "90mm", "95mm", "98mm"] as const
export const cupSizes = ["6.5oz", "8oz", "12oz", "16oz", "20oz", "22oz"] as const
export const cupColors = ["transparent", "black", "white", "kraft"] as const

export type CupType = (typeof cupTypes)[number]
export type CupBrand = (typeof cupBrands)[number]
export type CupDiameter = (typeof cupDiameters)[number]
export type CupSize = (typeof cupSizes)[number]
export type CupColor = (typeof cupColors)[number]

export function getAllowedCupBrands(type: CupType): readonly CupBrand[] {
  return type === "paper" ? ["other_supplier"] : cupBrands
}

export function getAllowedCupDiameters(type: CupType): readonly CupDiameter[] {
  return type === "paper" ? ["80mm", "90mm"] : ["95mm", "98mm"]
}

export function getAllowedCupSizes(type: CupType): readonly CupSize[] {
  return type === "paper"
    ? ["6.5oz", "8oz", "12oz", "16oz"]
    : ["12oz", "16oz", "20oz", "22oz"]
}

export function getAllowedCupColors(type: CupType, brand: CupBrand): readonly CupColor[] {
  if (type === "paper") {
    return ["white", "black", "kraft"]
  }

  if (brand === "dabba" || brand === "grecoopack") {
    return ["transparent"]
  }

  return ["transparent", "black"]
}

export function formatCupContractLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}
