import type { ReactNode } from "react"
import { Image, Text, View } from "@react-pdf/renderer"

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
  logoSrc,
}: {
  brand: ReactNode
  title: string
  reference: string
  subtitle?: string
  status?: ReactNode
  /** File path, URL, or data URI for @react-pdf `Image` */
  logoSrc?: string
}) {
  return (
    <View fixed style={sharedStyles.fixedHeader}>
      <View style={sharedStyles.headerBrandRow}>
        {logoSrc ? (
          <Image
            src={logoSrc}
            style={sharedStyles.headerLogo}
          />
        ) : null}
        <View style={sharedStyles.headerBrandText}>
          {brand}
          <Text style={{ ...sharedStyles.muted, paddingTop: 6 }}>Highlighting your brand through print and packaging.</Text>
        </View>
      </View>

      <View style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <Text style={sharedStyles.title}>{title}</Text>
        {subtitle ? <Text style={sharedStyles.muted}>{subtitle}</Text> : null}
        {status}
      </View>
    </View>
  )
}
