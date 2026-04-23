import { z } from "zod"

export const lidTypes = ["paper", "plastic"] as const
export const lidBrands = [
  "dabba",
  "grecoopack",
  "china_supplier",
  "other_supplier",
] as const
export const lidDiameters = ["80mm", "90mm", "95mm", "98mm"] as const
export const lidShapes = ["dome", "flat", "strawless", "coffee_lid", "tall_lid"] as const
export const lidColors = ["transparent", "black", "white"] as const

export const lidTypeSchema = z.enum(lidTypes)
export const lidBrandSchema = z.enum(lidBrands)
export const lidDiameterSchema = z.enum(lidDiameters)
export const lidShapeSchema = z.enum(lidShapes)
export const lidColorSchema = z.enum(lidColors)

export interface LidContractShape {
  type: (typeof lidTypes)[number]
  brand: (typeof lidBrands)[number]
  diameter: (typeof lidDiameters)[number]
  shape: (typeof lidShapes)[number]
  color: (typeof lidColors)[number]
}

export function getAllowedLidBrands(type: LidContractShape["type"]): readonly LidContractShape["brand"][] {
  return type === "paper" ? ["other_supplier"] : lidBrands
}

export function getAllowedLidDiameters(
  type: LidContractShape["type"],
): readonly LidContractShape["diameter"][] {
  return type === "paper" ? ["80mm", "90mm"] : ["95mm", "98mm"]
}

export function getAllowedLidShapes(type: LidContractShape["type"]): readonly LidContractShape["shape"][] {
  return type === "paper" ? ["coffee_lid"] : ["dome", "flat", "strawless", "tall_lid"]
}

export function getAllowedLidColors(type: LidContractShape["type"]): readonly LidContractShape["color"][] {
  return type === "paper" ? ["black", "white"] : ["transparent"]
}

export function addLidContractIssues(input: LidContractShape, context: z.RefinementCtx): void {
  if (!getAllowedLidBrands(input.type).includes(input.brand)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["brand"],
      message:
        input.type === "paper"
          ? "Paper lids must use other_supplier."
          : "Invalid brand for the selected lid type.",
    })
  }

  if (!getAllowedLidDiameters(input.type).includes(input.diameter)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["diameter"],
      message:
        input.type === "paper"
          ? "Paper lids must use 80mm or 90mm."
          : "Plastic lids must use 95mm or 98mm.",
    })
  }

  if (!getAllowedLidShapes(input.type).includes(input.shape)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["shape"],
      message:
        input.type === "paper"
          ? "Paper lids must use coffee_lid."
          : "Plastic lids must use dome, flat, strawless, or tall_lid.",
    })
  }

  if (!getAllowedLidColors(input.type).includes(input.color)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["color"],
      message:
        input.type === "paper"
          ? "Paper lids must use black or white."
          : "Plastic lids must be transparent.",
    })
  }
}
