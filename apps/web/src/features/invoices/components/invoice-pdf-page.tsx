import { useEffect, useState } from "react"

import { Link } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { fetchInvoicePdfBlob } from "@/features/invoices/api/invoices-client"

export function InvoicePdfPage({ invoiceId }: { invoiceId: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let createdUrl: string | null = null
    const run = async () => {
      setError(null)
      setIsLoading(true)
      setObjectUrl(null)
      try {
        const blob = await fetchInvoicePdfBlob(invoiceId)
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load the invoice PDF.")
      } finally {
        setIsLoading(false)
      }
    }

    void run()
    return () => {
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [invoiceId])

  if (isLoading) {
    return <Skeleton className="min-h-[70vh] w-full" />
  }

  if (error) {
    return (
      <div className="grid max-w-lg gap-3">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link to="/invoices/$invoiceId" params={{ invoiceId }}>
            Back to invoice
          </Link>
        </Button>
      </div>
    )
  }

  if (!objectUrl) {
    return null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/invoices/$invoiceId" params={{ invoiceId }}>
            Back to invoice
          </Link>
        </Button>
      </div>
      <iframe
        title="Invoice PDF"
        src={objectUrl}
        className="min-h-[70vh] w-full flex-1 rounded-md border"
      />
    </div>
  )
}
