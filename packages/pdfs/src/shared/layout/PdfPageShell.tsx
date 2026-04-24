import type { ReactNode } from "react"
import { Page, Text, View } from "@react-pdf/renderer"

import { sharedStyles } from "../theme/index.js"

export function PdfPageShell({
  header,
  footerLeft,
  footerCenter,
  children,
}: {
  header: ReactNode
  footerLeft?: string
  footerCenter?: string
  children: ReactNode
}) {
  return (
    <Page size="A4" style={sharedStyles.page} wrap>
      {header}

      <View style={sharedStyles.content}>{children}</View>

      <View fixed style={sharedStyles.fixedFooter}>
        <Text style={sharedStyles.muted}>{footerLeft}</Text>
        <Text style={sharedStyles.muted}>{footerCenter}</Text>
        <Text
          style={sharedStyles.muted}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </Page>
  )
}
