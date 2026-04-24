import {
  Document,
  Text,
  View,
} from "@react-pdf/renderer"

import { formatMoney } from "../shared/format.js"
import {
  PdfHeader,
  PdfMetaGrid,
  PdfPageShell,
  PdfPartiesBlock,
  PdfSection,
  PdfStatusBadge,
  PdfSummaryBlock,
  PdfTable,
  sharedStyles,
} from "../shared/index.js"
import type { InvoicePdfData } from "../shared/types/index.js"

export function InvoiceDocument({ invoice }: { invoice: InvoicePdfData }) {
  return (
    <Document>
      <PdfPageShell
        header={
          <PdfHeader
            brand={<Text style={sharedStyles.hero}>Ink Wave</Text>}
            title="Invoice"
            reference={invoice.invoice_number}
            subtitle={invoice.order_number_snapshot}
            status={<PdfStatusBadge label="Pending" tone="warning" />}
          />
        }
        footerLeft={`Generated ${new Date(invoice.created_at).toLocaleDateString("en-PH")}`}
        footerCenter="Ink Wave Branding App"
      >
        <View style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Text style={sharedStyles.invoiceRef}>{invoice.invoice_number}</Text>
          <Text style={sharedStyles.muted}>Print order invoice</Text>
        </View>

        <PdfSection>
          <PdfPartiesBlock
            left={{
              label: "From",
              name: "Ink Wave Branding App",
              lines: ["Cup printing operations"],
            }}
            right={{
              label: "To",
              name: invoice.customer.business_name,
              lines: getCustomerLines(invoice),
            }}
          />
        </PdfSection>

        <PdfSection>
          <PdfMetaGrid
            leftTitle="Invoice details"
            leftItems={[
              { label: "Invoice number", value: invoice.invoice_number },
              { label: "Generated", value: new Date(invoice.created_at).toLocaleDateString("en-PH") },
            ]}
            rightTitle="Order details"
            rightItems={[
              { label: "Order reference", value: invoice.order_number_snapshot },
              { label: "Line items", value: invoice.items.length.toLocaleString() },
            ]}
          />
        </PdfSection>

        <PdfSection title="Charges">
          <PdfTable
            columns={[
              {
                key: "item",
                title: "Item",
                width: "26%",
                render: (item) => item.description_snapshot,
              },
              {
                key: "specs",
                title: "Specs",
                width: "28%",
                render: (item) => formatInvoiceItemType(item.item_type),
              },
              {
                key: "quantity",
                title: "Quantity",
                width: "12%",
                align: "right",
                render: (item) => item.quantity.toLocaleString(),
              },
              {
                key: "unitPrice",
                title: "Unit Price",
                width: "17%",
                align: "right",
                render: (item) => formatMoney(item.unit_price),
              },
              {
                key: "total",
                title: "Total",
                width: "17%",
                align: "right",
                render: (item) => formatMoney(item.line_total),
              },
            ]}
            rows={invoice.items}
          />

          <PdfSummaryBlock
            rows={[
              {
                label: "Subtotal",
                value: formatMoney(invoice.subtotal),
                emphasis: true,
              },
            ]}
          />
        </PdfSection>
      </PdfPageShell>
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

function getCustomerLines(invoice: InvoicePdfData) {
  return [
    invoice.customer.contact_person,
    invoice.customer.contact_number,
    invoice.customer.email,
    invoice.customer.address,
    invoice.customer.customer_code ? `Code: ${invoice.customer.customer_code}` : null,
  ].filter((line): line is string => Boolean(line))
}
