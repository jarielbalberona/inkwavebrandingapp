import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getInvoice,
  recordInvoicePayment,
  listInvoices,
  voidInvoice,
  type ListInvoicesFilters,
  type RecordInvoicePaymentPayload,
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

export function useRecordInvoicePaymentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      invoiceId,
      payload,
    }: {
      invoiceId: string
      payload: RecordInvoicePaymentPayload
    }) => recordInvoicePayment(invoiceId, payload),
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: invoicesQueryKey })
      await queryClient.invalidateQueries({
        queryKey: [...invoicesQueryKey, "detail", invoice.id],
      })
      await queryClient.invalidateQueries({
        queryKey: ["orders", "invoice", invoice.order_id],
      })
    },
  })
}

export function useVoidInvoiceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invoiceId: string) => voidInvoice(invoiceId),
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: invoicesQueryKey })
      await queryClient.invalidateQueries({
        queryKey: [...invoicesQueryKey, "detail", invoice.id],
      })
      await queryClient.invalidateQueries({
        queryKey: ["orders", "invoice", invoice.order_id],
      })
    },
  })
}
