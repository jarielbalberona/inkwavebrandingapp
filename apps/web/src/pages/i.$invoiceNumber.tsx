import { createFileRoute } from "@tanstack/react-router"

import { PublicInvoicePdfPage } from "@/features/invoices/components/public-invoice-pdf-page"

export const Route = createFileRoute("/i/$invoiceNumber")({
  component: RouteComponent,
})

function RouteComponent() {
  const { invoiceNumber } = Route.useParams()

  return <PublicInvoicePdfPage invoiceNumber={invoiceNumber} />
}
