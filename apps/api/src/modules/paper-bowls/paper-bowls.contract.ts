import { z } from "zod"

export const paperBowlSizes = ["220cc", "320cc", "390cc", "520cc", "750cc"] as const
export const paperBowlColors = ["white", "kraft"] as const

export const paperBowlSizeSchema = z.enum(paperBowlSizes)
export const paperBowlColorSchema = z.enum(paperBowlColors)

export type PaperBowlSize = (typeof paperBowlSizes)[number]
export type PaperBowlColor = (typeof paperBowlColors)[number]

export function generatePaperBowlSku(input: {
  size: PaperBowlSize
  color: PaperBowlColor
}): string {
  const colorCode = input.color === "white" ? "WHT" : "KRFT"
  return `${input.size.toUpperCase()}-PAPER-BOWL-OTHSPLR-${colorCode}`
}

export function formatPaperBowlName(input: {
  size: PaperBowlSize
  color: PaperBowlColor
}): string {
  const color = input.color.charAt(0).toUpperCase() + input.color.slice(1)
  return `${input.size} ${color} Paper Bowl`
}
