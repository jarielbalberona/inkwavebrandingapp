import {
  Document,
  Text,
  View,
} from "@react-pdf/renderer"

import { formatMoney } from "../shared/format.js"
import { IW_LOGO_PATH } from "../iw-logo-path.js"
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
    <Document title={invoice.invoice_number}>
      <PdfPageShell
        header={
          <PdfHeader
            brand={<Text style={sharedStyles.hero}>{invoice.brand_name}</Text>}
            logoSrc={IW_LOGO_PATH}
            title={invoice.document_title}
            reference={invoice.invoice_number}
            subtitle={invoice.order_reference}
            status={<PdfStatusBadge label={invoice.status.label} tone={invoice.status.tone} />}
          />
        }
        footerLeft={`Generated ${invoice.generated_at}`}
        footerCenter={invoice.support_lines[0]}
      >
        <View style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Text style={sharedStyles.invoiceRef}>{invoice.invoice_number}</Text>
          <Text style={sharedStyles.muted}>Print order invoice</Text>
        </View>

        <PdfSection>
          <PdfPartiesBlock
            left={invoice.from}
            right={invoice.to}
          />
        </PdfSection>

        <PdfSection>
          <PdfMetaGrid
            leftTitle="Invoice details"
            leftItems={invoice.left_meta}
            rightTitle="Order details"
            rightItems={invoice.right_meta}
          />
        </PdfSection>

        <PdfSection
          title="Charges"
          description="Order-specific line items for this print job."
        >
          <PdfTable
            columns={[
              {
                key: "item",
                title: "Item",
                width: "26%",
                render: (item) => item.item,
              },
              {
                key: "specs",
                title: "Specs",
                width: "28%",
                render: (item) => item.specs,
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
                render: (item) => formatMoney(item.total),
              },
            ]}
            rows={invoice.line_items}
          />

          <PdfSummaryBlock
            rows={[
              {
                label: "Subtotal",
                value: formatMoney(invoice.subtotal),
              },
              {
                label: "Discount",
                value: formatMoney(invoice.discount),
              },
              {
                label: "Total",
                value: formatMoney(invoice.total),
              },
              {
                label: "Paid amount",
                value: formatMoney(invoice.paid_amount),
              },
              {
                label: "Remaining balance",
                value: formatMoney(invoice.remaining_balance),
                emphasis: true,
              },
            ]}
          />
        </PdfSection>

        <PdfSection title="Payment and support">
          <View style={sharedStyles.footerBlock}>
            {invoice.payment_instructions.map((line) => (
              <Text key={line} style={sharedStyles.body}>
                {line}
              </Text>
            ))}
          </View>

          <View style={sharedStyles.footerBlock}>
            {invoice.support_lines.map((line) => (
              <Text key={line} style={sharedStyles.muted}>
                {line}
              </Text>
            ))}
          </View>

          {invoice.footer_note ? <Text style={sharedStyles.muted}>{invoice.footer_note}</Text> : null}
        </PdfSection>
      </PdfPageShell>
    </Document>
  )
}
