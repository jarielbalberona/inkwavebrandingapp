import { eq } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  invoiceItems,
  invoices,
  type NewInvoice,
  type NewInvoiceItem,
} from "../../db/schema/index.js"

export type InvoiceWithRelations = NonNullable<
  Awaited<ReturnType<InvoicesRepository["findByIdWithRelations"]>>
>

export class InvoicesRepository {
  constructor(private readonly db: DatabaseClient) {}

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

  async findByIdWithRelations(id: string) {
    return this.db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: {
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
        items: {
          with: {
            orderItem: true,
          },
        },
      },
    })
  }
}
