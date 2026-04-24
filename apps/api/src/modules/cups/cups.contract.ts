import { z } from "zod"

export const cupTypes = ["paper", "plastic"] as const
export const cupBrands = [
  "dabba",
  "grecoopack",
  "brand_1",
  "other_supplier",
] as const
export const cupDiameters = ["80mm", "90mm", "95mm", "98mm"] as const
export const cupSizes = ["6.5oz", "8oz", "12oz", "16oz", "20oz", "22oz"] as const
export const cupColors = ["transparent", "black", "white", "kraft"] as const

export const cupTypeSchema = z.enum(cupTypes)
export const cupBrandSchema = z.enum(cupBrands)
export const cupDiameterSchema = z.enum(cupDiameters)
export const cupSizeSchema = z.enum(cupSizes)
export const cupColorSchema = z.enum(cupColors)

export interface CupContractShape {
  type: (typeof cupTypes)[number]
  brand: (typeof cupBrands)[number]
  diameter: (typeof cupDiameters)[number]
  size: (typeof cupSizes)[number]
  color: (typeof cupColors)[number]
}

export function getAllowedCupBrands(type: CupContractShape["type"]): readonly CupContractShape["brand"][] {
  return type === "paper" ? ["other_supplier"] : cupBrands
}

export function getAllowedCupDiameters(
  type: CupContractShape["type"],
  brand: CupContractShape["brand"],
): readonly CupContractShape["diameter"][] {
  if (type === "paper") {
    return ["80mm", "90mm"]
  }

  if (brand === "dabba" || brand === "grecoopack") {
    return ["95mm"]
  }

  return ["95mm", "98mm"]
}

export function getAllowedCupSizes(type: CupContractShape["type"]): readonly CupContractShape["size"][] {
  return type === "paper"
    ? ["6.5oz", "8oz", "12oz", "16oz"]
    : ["12oz", "16oz", "20oz", "22oz"]
}

export function getAllowedCupColors(
  type: CupContractShape["type"],
  brand: CupContractShape["brand"],
): readonly CupContractShape["color"][] {
  if (type === "paper") {
    return ["white", "black", "kraft"]
  }

  if (brand === "dabba" || brand === "grecoopack") {
    return ["transparent"]
  }

  return ["transparent", "black"]
}

export function addCupContractIssues(input: CupContractShape, context: z.RefinementCtx): void {
  if (!getAllowedCupBrands(input.type).includes(input.brand)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["brand"],
      message:
        input.type === "paper"
          ? "Paper cups must use other_supplier."
          : "Invalid brand for the selected cup type.",
    })
  }

  if (!getAllowedCupDiameters(input.type, input.brand).includes(input.diameter)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["diameter"],
      message:
        input.type === "paper"
          ? "Paper cups must use 80mm or 90mm."
          : input.brand === "dabba" || input.brand === "grecoopack"
            ? "Dabba and Grecoopack plastic cups must use 95mm."
            : "Brand 1 and other supplier plastic cups must use 95mm or 98mm.",
    })
  }

  if (!getAllowedCupSizes(input.type).includes(input.size)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["size"],
      message:
        input.type === "paper"
          ? "Paper cups must use 6.5oz, 8oz, 12oz, or 16oz."
          : "Plastic cups must use 12oz, 16oz, 20oz, or 22oz.",
    })
  }

  if (!getAllowedCupColors(input.type, input.brand).includes(input.color)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["color"],
      message:
        input.type === "paper"
          ? "Paper cups must use white, black, or kraft."
          : input.brand === "dabba" || input.brand === "grecoopack"
            ? "Dabba and Grecoopack plastic cups must be transparent."
            : "Brand 1 and other supplier plastic cups must be transparent or black.",
    })
  }
}
