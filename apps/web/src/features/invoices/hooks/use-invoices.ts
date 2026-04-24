import { useQuery } from "@tanstack/react-query"

import {
  getInvoice,
  listInvoices,
  type ListInvoicesFilters,
} from "@/features/invoices/api/invoices-client"

export const invoicesQueryKey = ["invoices"] as const

export function useInvoicesQuery(filters: ListInvoicesFilters = {}) {
  return useQuery({
    queryKey: [...invoicesQueryKey, filters] as const,
    queryFn: () => listInvoices(filters),
  })
}

export function useInvoiceQuery(invoiceId: string | null) {
  return useQuery({
    queryKey: [...invoicesQueryKey, "detail", invoiceId] as const,
    queryFn: () => getInvoice(invoiceId ?? ""),
    enabled: Boolean(invoiceId),
  })
}
