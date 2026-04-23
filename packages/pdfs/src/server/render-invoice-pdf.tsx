import { renderToBuffer } from "@react-pdf/renderer"

import { InvoiceDocument } from "../invoices/invoice-document.js"
import type { InvoicePdfData } from "../shared/invoice-pdf.types.js"

export async function renderInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} />)
}
