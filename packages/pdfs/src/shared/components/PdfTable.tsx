import { Text, View } from "@react-pdf/renderer"

import { invoiceTokens, sharedStyles } from "../theme/index.js"

export interface PdfTableColumn<Row> {
  key: string
  title: string
  width: string
  align?: "left" | "center" | "right"
  render: (row: Row) => string
}

export function PdfTable<Row>({
  columns,
  rows,
  fontSize = invoiceTokens.type.md,
}: {
  columns: PdfTableColumn<Row>[]
  rows: Row[]
  fontSize?: number
}) {
  return (
    <View style={sharedStyles.table}>
      <View style={sharedStyles.tableHeader}>
        {columns.map((column) =>
          renderCell(column.key, column.title, column.width, column.align, fontSize, true)
        )}
      </View>

      {rows.map((row, index) => (
        <View key={index} style={sharedStyles.tableRow} wrap>
          {columns.map((column) =>
            renderCell(
              column.key,
              column.render(row),
              column.width,
              column.align,
              fontSize,
              false
            )
          )}
        </View>
      ))}
    </View>
  )
}

function renderCell(
  key: string,
  value: string,
  width: string,
  align: "left" | "center" | "right" = "left",
  fontSize: number,
  bold: boolean
) {
  return (
    <View key={key} style={[sharedStyles.cell, { width }]}>
      <Text
        style={{
          fontSize,
          textAlign: align,
          color: invoiceTokens.colors.textPrimary,
          fontFamily: bold ? invoiceTokens.fonts.bold : invoiceTokens.fonts.regular,
        }}
      >
        {value}
      </Text>
    </View>
  )
}
