import type { ReactNode } from "react"
import { Text, View } from "@react-pdf/renderer"

import { sharedStyles } from "../theme/index.js"

export function PdfSection({
  title,
  description,
  children,
}: {
  title?: string
  description?: string
  children: ReactNode
}) {
  return (
    <View style={sharedStyles.section}>
      {title ? <Text style={sharedStyles.sectionTitle}>{title}</Text> : null}
      {description ? <Text style={sharedStyles.muted}>{description}</Text> : null}
      {children}
    </View>
  )
}
