import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import { formatMoney } from "../shared/format.js"
import type { InvoicePdfData } from "../shared/invoice-pdf.types.js"

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  block: {
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
  },
  tableHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 8,
    marginBottom: 8,
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase",
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
  },
  colDescription: {
    width: "46%",
    paddingRight: 8,
  },
  colType: {
    width: "12%",
    paddingRight: 8,
  },
  colQty: {
    width: "12%",
    textAlign: "right",
    paddingRight: 8,
  },
  colUnit: {
    width: "15%",
    textAlign: "right",
    paddingRight: 8,
  },
  colLine: {
    width: "15%",
    textAlign: "right",
  },
  totalWrap: {
    marginTop: 18,
    alignSelf: "flex-end",
    width: 220,
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    fontSize: 10,
    color: "#6b7280",
    textTransform: "uppercase",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 700,
  },
})

export function InvoiceDocument({ invoice }: { invoice: InvoicePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Ink Wave Invoice</Text>
            <Text>{invoice.invoice_number}</Text>
            <Text>Order: {invoice.order_number_snapshot}</Text>
          </View>

          <View>
            <Text style={styles.label}>Generated</Text>
            <Text>{new Date(invoice.created_at).toLocaleDateString("en-PH")}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Bill To</Text>
          <Text>{invoice.customer.business_name}</Text>
          {invoice.customer.customer_code ? <Text>Code: {invoice.customer.customer_code}</Text> : null}
          {invoice.customer.contact_person ? <Text>Contact: {invoice.customer.contact_person}</Text> : null}
          {invoice.customer.contact_number ? <Text>Phone: {invoice.customer.contact_number}</Text> : null}
          {invoice.customer.email ? <Text>Email: {invoice.customer.email}</Text> : null}
          {invoice.customer.address ? <Text>Address: {invoice.customer.address}</Text> : null}
        </View>

        <View style={[styles.row, styles.tableHeader]}>
          <Text style={styles.colDescription}>Description</Text>
          <Text style={styles.colType}>Type</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colUnit}>Unit Price</Text>
          <Text style={styles.colLine}>Line Total</Text>
        </View>

        {invoice.items.map((item) => (
          <View key={item.id} style={[styles.row, styles.tableRow]}>
            <Text style={styles.colDescription}>{item.description_snapshot}</Text>
            <Text style={styles.colType}>{formatInvoiceItemType(item.item_type)}</Text>
            <Text style={styles.colQty}>{item.quantity.toLocaleString()}</Text>
            <Text style={styles.colUnit}>{formatMoney(item.unit_price)}</Text>
            <Text style={styles.colLine}>{formatMoney(item.line_total)}</Text>
          </View>
        ))}

        <View style={styles.totalWrap}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <View style={styles.totalRow}>
            <Text>PHP</Text>
            <Text style={styles.totalValue}>{formatMoney(invoice.subtotal)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

function formatInvoiceItemType(itemType: InvoicePdfData["items"][number]["item_type"]) {
  switch (itemType) {
    case "cup":
      return "Cup"
    case "lid":
      return "Lid"
    case "non_stock_item":
      return "General"
    case "custom_charge":
      return "Charge"
  }
}
