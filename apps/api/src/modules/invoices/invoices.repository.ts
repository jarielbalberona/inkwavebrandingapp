import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  invoiceItems,
  invoices,
  type NewInvoice,
  type NewInvoiceItem,
} from "../../db/schema/index.js"
import type { InvoicesListQuery } from "./invoices.schemas.js"

export type InvoiceWithRelations = NonNullable<
  Awaited<ReturnType<InvoicesRepository["findByIdWithRelations"]>>
>

export class InvoicesRepository {
  constructor(private readonly db: DatabaseClient) {}

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
      },
    })
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
}
