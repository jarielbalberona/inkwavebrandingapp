import { and, desc, eq, gte, ilike, isNull, lte, ne, or } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  invoiceItems,
  invoicePayments,
  invoices,
  type NewInvoice,
  type NewInvoiceItem,
  type NewInvoicePayment,
} from "../../db/schema/index.js"
import type { InvoicesListQuery } from "./invoices.schemas.js"

export type InvoiceWithRelations = NonNullable<
  Awaited<ReturnType<InvoicesRepository["findByIdWithRelations"]>>
>

export class InvoicesRepository {
  constructor(private readonly db: DatabaseClient) {}

  async transaction<T>(
    handler: (context: { db: DatabaseClient; invoicesRepository: InvoicesRepository }) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) =>
      handler({
        db: tx as DatabaseClient,
        invoicesRepository: new InvoicesRepository(tx as DatabaseClient),
      }),
    )
  }

  async list(query: InvoicesListQuery) {
    const conditions = [
      query.search
        ? or(
            ilike(invoices.invoiceNumber, `%${query.search}%`),
            ilike(invoices.orderNumberSnapshot, `%${query.search}%`),
            ilike(invoices.customerBusinessNameSnapshot, `%${query.search}%`),
            ilike(invoices.customerCodeSnapshot, `%${query.search}%`),
          )
        : undefined,
      query.customer_id ? eq(invoices.customerId, query.customer_id) : undefined,
      query.order_id ? eq(invoices.orderId, query.order_id) : undefined,
      query.start_date ? gte(invoices.createdAt, query.start_date) : undefined,
      query.end_date ? lte(invoices.createdAt, query.end_date) : undefined,
      isNull(invoices.archivedAt),
      query.include_void ? undefined : ne(invoices.status, "void"),
    ].filter(Boolean)

    return this.db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
  }

  async createInvoiceWithItems(input: {
    invoice: NewInvoice
    items: Omit<NewInvoiceItem, "invoiceId">[]
  }): Promise<InvoiceWithRelations> {
    const rows = await this.db.insert(invoices).values(input.invoice).returning()
    const invoice = rows[0]

    if (!invoice) {
      throw new Error("Failed to create invoice")
    }

    if (input.items.length > 0) {
      await this.db
        .insert(invoiceItems)
        .values(input.items.map((item) => ({ ...item, invoiceId: invoice.id })))
    }

    const invoiceWithRelations = await this.findByIdWithRelations(invoice.id)

    if (!invoiceWithRelations) {
      throw new Error("Failed to load created invoice")
    }

    return invoiceWithRelations
  }

  async replaceInvoiceSnapshotWithItems(input: {
    invoiceId: string
    invoice: Pick<
      NewInvoice,
      | "orderNumberSnapshot"
      | "customerId"
      | "customerCodeSnapshot"
      | "customerBusinessNameSnapshot"
      | "customerContactPersonSnapshot"
      | "customerContactNumberSnapshot"
      | "customerEmailSnapshot"
      | "customerAddressSnapshot"
      | "subtotal"
      | "totalAmount"
      | "remainingBalance"
    >
    items: Omit<NewInvoiceItem, "invoiceId">[]
  }): Promise<InvoiceWithRelations> {
    await this.db
      .update(invoices)
      .set({
        ...input.invoice,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, input.invoiceId))

    await this.db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, input.invoiceId))

    if (input.items.length > 0) {
      await this.db
        .insert(invoiceItems)
        .values(input.items.map((item) => ({ ...item, invoiceId: input.invoiceId })))
    }

    const invoiceWithRelations = await this.findByIdWithRelations(input.invoiceId)

    if (!invoiceWithRelations) {
      throw new Error("Failed to load replaced invoice")
    }

    return invoiceWithRelations
  }

  async deleteInvoiceItems(invoiceId: string): Promise<void> {
    await this.db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId))
  }

  async findByIdWithRelations(id: string) {
    return this.db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: {
        documentAsset: true,
        items: {
          with: {
            orderItem: true,
          },
        },
        payments: {
          with: {
            createdByUser: true,
          },
        },
      },
    })
  }

  async findByOrderId(orderId: string) {
    return this.db.query.invoices.findFirst({
      where: eq(invoices.orderId, orderId),
      with: {
        documentAsset: true,
        items: {
          with: {
            orderItem: true,
          },
        },
        payments: {
          with: {
            createdByUser: true,
          },
        },
      },
    })
  }

  async createPayment(input: {
    invoiceId: string
    payment: Omit<NewInvoicePayment, "invoiceId">
  }) {
    const rows = await this.db
      .insert(invoicePayments)
      .values({
        ...input.payment,
        invoiceId: input.invoiceId,
      })
      .returning()

    return rows[0] ?? null
  }

  async updatePayment(input: {
    invoiceId: string
    paymentId: string
    payment: Pick<NewInvoicePayment, "amount" | "paymentDate" | "note">
  }) {
    const rows = await this.db
      .update(invoicePayments)
      .set({
        amount: input.payment.amount,
        paymentDate: input.payment.paymentDate,
        note: input.payment.note,
        updatedAt: new Date(),
      })
      .where(and(eq(invoicePayments.id, input.paymentId), eq(invoicePayments.invoiceId, input.invoiceId)))
      .returning()

    return rows[0] ?? null
  }

  async deletePayment(input: { invoiceId: string; paymentId: string }) {
    const rows = await this.db
      .delete(invoicePayments)
      .where(and(eq(invoicePayments.id, input.paymentId), eq(invoicePayments.invoiceId, input.invoiceId)))
      .returning()

    return rows[0] ?? null
  }

  async updateFinancialState(
    invoiceId: string,
    input: Pick<NewInvoice, "status" | "paidAmount" | "remainingBalance">,
  ): Promise<void> {
    await this.db
      .update(invoices)
      .set({
        status: input.status,
        paidAmount: input.paidAmount,
        remainingBalance: input.remainingBalance,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
  }

  async setDocumentAssetId(invoiceId: string, documentAssetId: string | null): Promise<void> {
    await this.db
      .update(invoices)
      .set({
        documentAssetId,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
  }

  async archive(invoiceId: string): Promise<void> {
    await this.db
      .update(invoices)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
  }
}
