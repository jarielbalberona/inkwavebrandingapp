export const lidTypes = ["paper", "plastic"] as const
export const lidBrands = [
  "dabba",
  "grecoopack",
  "brand_1",
  "other_supplier",
] as const
export const lidDiameters = ["80mm", "90mm", "95mm", "98mm"] as const
export const lidShapes = ["dome", "flat", "strawless", "coffee_lid", "tall_lid"] as const
export const lidColors = ["transparent", "black", "white"] as const

export type LidType = (typeof lidTypes)[number]
export type LidBrand = (typeof lidBrands)[number]
export type LidDiameter = (typeof lidDiameters)[number]
export type LidShape = (typeof lidShapes)[number]
export type LidColor = (typeof lidColors)[number]

export function getAllowedLidBrands(type: LidType): readonly LidBrand[] {
  return type === "paper" ? ["other_supplier"] : lidBrands
}

export function getAllowedLidDiameters(type: LidType): readonly LidDiameter[] {
  return type === "paper" ? ["80mm", "90mm"] : ["95mm", "98mm"]
}

export function getAllowedLidShapes(type: LidType): readonly LidShape[] {
  return type === "paper" ? ["coffee_lid"] : ["dome", "flat", "strawless", "tall_lid"]
}

export function getAllowedLidColors(type: LidType, brand: LidBrand): readonly LidColor[] {
  if (type === "paper") {
    return ["black", "white"]
  }

  if (brand === "dabba" || brand === "grecoopack") {
    return ["transparent"]
  }

  return ["transparent", "black"]
}

export function formatLidContractLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}
