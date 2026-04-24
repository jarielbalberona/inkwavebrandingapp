import { Text, View } from "@react-pdf/renderer"

import { sharedStyles } from "../theme/index.js"

export interface PdfMetaItem {
  label: string
  value: string
}

export function PdfMetaGrid({
  leftTitle,
  leftItems,
  rightTitle,
  rightItems,
}: {
  leftTitle: string
  leftItems: PdfMetaItem[]
  rightTitle?: string
  rightItems?: PdfMetaItem[]
}) {
  return (
    <View style={sharedStyles.splitRow}>
      <MetaColumn title={leftTitle} items={leftItems} />
      {rightTitle && rightItems ? (
        <MetaColumn title={rightTitle} items={rightItems} />
      ) : (
        <View style={sharedStyles.column} />
      )}
    </View>
  )
}

function MetaColumn({
  title,
  items,
}: {
  title: string
  items: PdfMetaItem[]
}) {
  return (
    <View style={sharedStyles.column}>
      <Text style={sharedStyles.sectionTitle}>{title}</Text>
      <View style={sharedStyles.metaStack}>
        {items.map((item) => (
          <View key={item.label} style={sharedStyles.metaRow}>
            <Text style={sharedStyles.overline}>{item.label}</Text>
            <Text style={sharedStyles.bodyBold}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
