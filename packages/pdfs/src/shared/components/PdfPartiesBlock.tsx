import { Text, View } from "@react-pdf/renderer"

import { sharedStyles } from "../theme/index.js"

export interface PdfParty {
  label: string
  name: string
  lines: string[]
}

export function PdfPartiesBlock({
  left,
  right,
}: {
  left: PdfParty
  right: PdfParty
}) {
  return (
    <View style={sharedStyles.splitRow}>
      {renderParty(left)}
      {renderParty(right)}
    </View>
  )
}

function renderParty(party: PdfParty) {
  return (
    <View key={party.label} style={sharedStyles.column}>
      <Text style={sharedStyles.overline}>{party.label}</Text>
      <Text style={sharedStyles.bodyBold}>{party.name}</Text>
      {party.lines.map((line) => (
        <Text key={line} style={sharedStyles.muted}>
          {line}
        </Text>
      ))}
    </View>
  )
}
