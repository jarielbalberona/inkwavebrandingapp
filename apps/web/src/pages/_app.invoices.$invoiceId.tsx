import { createFileRoute } from "@tanstack/react-router"

import { InvoiceDetailPage } from "@/features/invoices/components/invoice-detail-page"

export const Route = createFileRoute("/_app/invoices/$invoiceId")({
  component: InvoiceDetailRoute,
})

function InvoiceDetailRoute() {
  const { invoiceId } = Route.useParams()

  return <InvoiceDetailPage invoiceId={invoiceId} />
}
