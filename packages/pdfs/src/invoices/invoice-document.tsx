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
import { toInkWaveInvoiceViewModel } from "./invoice-view-model.js"

export function InvoiceDocument({ invoice }: { invoice: InvoicePdfData }) {
  const viewModel = toInkWaveInvoiceViewModel(invoice)

  return (
    <Document>
      <PdfPageShell
        header={
          <PdfHeader
            brand={<Text style={sharedStyles.hero}>{viewModel.brandName}</Text>}
            title={viewModel.documentTitle}
            reference={viewModel.invoiceNumber}
            subtitle={viewModel.orderReference}
            status={<PdfStatusBadge label={viewModel.status.label} tone={viewModel.status.tone} />}
          />
        }
        footerLeft={`Generated ${viewModel.generatedAt}`}
        footerCenter={viewModel.supportLines[0]}
      >
        <View style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Text style={sharedStyles.invoiceRef}>{viewModel.invoiceNumber}</Text>
          <Text style={sharedStyles.muted}>Print order invoice</Text>
        </View>

        <PdfSection>
          <PdfPartiesBlock
            left={viewModel.from}
            right={viewModel.to}
          />
        </PdfSection>

        <PdfSection>
          <PdfMetaGrid
            leftTitle="Invoice details"
            leftItems={viewModel.leftMeta}
            rightTitle="Order details"
            rightItems={viewModel.rightMeta}
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
                render: (item) => formatMoney(item.unitPrice),
              },
              {
                key: "total",
                title: "Total",
                width: "17%",
                align: "right",
                render: (item) => formatMoney(item.total),
              },
            ]}
            rows={viewModel.lineItems}
          />

          <PdfSummaryBlock
            rows={[
              {
                label: "Subtotal",
                value: formatMoney(viewModel.summary.subtotal),
              },
              {
                label: "Discount",
                value: formatMoney(viewModel.summary.discount),
              },
              {
                label: "Total",
                value: formatMoney(viewModel.summary.total),
              },
              {
                label: "Paid amount",
                value: formatMoney(viewModel.summary.paidAmount),
              },
              {
                label: "Remaining balance",
                value: formatMoney(viewModel.summary.remainingBalance),
                emphasis: true,
              },
            ]}
          />
        </PdfSection>

        <PdfSection title="Payment and support">
          <View style={sharedStyles.footerBlock}>
            {viewModel.paymentInstructions.map((line) => (
              <Text key={line} style={sharedStyles.body}>
                {line}
              </Text>
            ))}
          </View>

          <View style={sharedStyles.footerBlock}>
            {viewModel.supportLines.map((line) => (
              <Text key={line} style={sharedStyles.muted}>
                {line}
              </Text>
            ))}
          </View>

          <Text style={sharedStyles.muted}>{viewModel.footerNote}</Text>
        </PdfSection>
      </PdfPageShell>
    </Document>
  )
}
