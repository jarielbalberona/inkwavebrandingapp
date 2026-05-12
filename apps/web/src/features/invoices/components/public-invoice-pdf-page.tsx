import { useEffect, useState } from "react"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { fetchPublicInvoicePdfBlob } from "@/features/invoices/api/invoices-client"

export function PublicInvoicePdfPage({ invoiceNumber }: { invoiceNumber: string }) {
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
        const blob = await fetchPublicInvoicePdfBlob(invoiceNumber)
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load this invoice PDF.")
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
  }, [invoiceNumber])

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Ink Wave Branding</p>
          <h1 className="text-lg font-semibold">{invoiceNumber}</h1>
        </div>
        {objectUrl ? (
          <Button asChild size="sm" variant="outline">
            <a href={objectUrl} target="_blank" rel="noreferrer">
              Open PDF
            </a>
          </Button>
        ) : null}
      </header>

      <section className="flex min-h-0 flex-1 p-3">
        {isLoading ? (
          <Skeleton className="min-h-[80vh] w-full" />
        ) : error ? (
          <div className="mx-auto mt-10 grid w-full max-w-lg gap-3">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : objectUrl ? (
          <iframe
            title={`Invoice ${invoiceNumber}`}
            src={objectUrl}
            className="min-h-[80vh] w-full flex-1 rounded-md border"
          />
        ) : null}
      </section>
    </main>
  )
}
