import type { ReactNode } from "react"
import { Text, View } from "@react-pdf/renderer"

import { sharedStyles } from "../theme/index.js"

export interface PdfHeaderStatus {
  label: string
  tone: "warning" | "success" | "danger" | "neutral"
}

export function PdfHeader({
  brand,
  title,
  reference,
  subtitle,
  status,
}: {
  brand: ReactNode
  title: string
  reference: string
  subtitle?: string
  status?: ReactNode
}) {
  return (
    <View fixed style={sharedStyles.fixedHeader}>
      <View style={sharedStyles.column}>
        {brand}
        <Text style={sharedStyles.muted}>{reference}</Text>
      </View>

      <View style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <Text style={sharedStyles.title}>{title}</Text>
        {subtitle ? <Text style={sharedStyles.muted}>{subtitle}</Text> : null}
        {status}
      </View>
    </View>
  )
}
