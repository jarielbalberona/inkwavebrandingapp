import { createFileRoute } from "@tanstack/react-router"

import { InvoicePdfPage } from "@/features/invoices/components/invoice-pdf-page"

export const Route = createFileRoute("/_app/invoices/$invoiceId/pdf")({
  component: InvoicePdfRoute,
})

function InvoicePdfRoute() {
  const { invoiceId } = Route.useParams()

  return <InvoicePdfPage invoiceId={invoiceId} />
}
