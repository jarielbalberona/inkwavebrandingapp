import { Text } from "@react-pdf/renderer"

import { invoiceTokens } from "../theme/index.js"

export type PdfStatusTone = "warning" | "success" | "danger" | "neutral"

export function PdfStatusBadge({
  label,
  tone,
}: {
  label: string
  tone: PdfStatusTone
}) {
  const palette = getTonePalette(tone)

  return (
    <Text
      style={{
        color: palette.color,
        backgroundColor: palette.backgroundColor,
        fontFamily: invoiceTokens.fonts.bold,
        fontSize: invoiceTokens.type.sm,
        paddingTop: 4,
        paddingBottom: 4,
        paddingHorizontal: 8,
        borderRadius: invoiceTokens.radius.sm,
      }}
    >
      {label}
    </Text>
  )
}

function getTonePalette(tone: PdfStatusTone) {
  switch (tone) {
    case "success":
      return {
        color: invoiceTokens.colors.success,
        backgroundColor: invoiceTokens.colors.successWash,
      }
    case "danger":
      return {
        color: invoiceTokens.colors.danger,
        backgroundColor: invoiceTokens.colors.dangerWash,
      }
    case "warning":
      return {
        color: invoiceTokens.colors.warning,
        backgroundColor: invoiceTokens.colors.warningWash,
      }
    default:
      return {
        color: invoiceTokens.colors.textMuted,
        backgroundColor: invoiceTokens.colors.brandWash,
      }
  }
}
