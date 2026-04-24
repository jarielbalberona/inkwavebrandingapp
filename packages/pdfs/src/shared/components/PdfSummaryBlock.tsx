import { Text, View } from "@react-pdf/renderer"

import { invoiceTokens, sharedStyles } from "../theme/index.js"

export interface PdfSummaryRow {
  label: string
  value: string
  emphasis?: boolean
}

export function PdfSummaryBlock({
  rows,
  width = "44%",
}: {
  rows: PdfSummaryRow[]
  width?: string
}) {
  return (
    <View style={sharedStyles.summaryWrap}>
      <View style={[sharedStyles.summaryBox, { width }]}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[
              sharedStyles.summaryRow,
              index === 0
                ? {}
                : { borderTopWidth: 1, borderTopColor: invoiceTokens.colors.borderDefault },
            ]}
          >
            <Text style={sharedStyles.muted}>{row.label}</Text>
            <Text
              style={{
                color: invoiceTokens.colors.textPrimary,
                fontFamily: invoiceTokens.fonts.bold,
                fontSize: row.emphasis ? invoiceTokens.type.lg : invoiceTokens.type.md,
              }}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
