import type { SafeUser } from "../auth/auth.schemas.js"
import { assertAdmin } from "../auth/authorization.js"
import type { InvoiceWithRelations } from "./invoices.repository.js"
import type { Invoice } from "../../db/schema/index.js"

export type InvoiceStatus = Invoice["status"]

export interface InvoiceListItemDto {
  id: string
  invoice_number: string
  order_id: string
  order_number_snapshot: string
  customer: {
    id: string
    customer_code: string | null
    business_name: string
  }
  status: InvoiceStatus
  subtotal: string
  created_at: string
  updated_at: string
}

export interface InvoiceItemDto {
  id: string
  order_line_item_id: string
  item_type: "cup" | "lid" | "non_stock_item" | "custom_charge"
  description_snapshot: string
  quantity: number
  unit_price: string
  line_total: string
  created_at: string
}

export interface InvoiceDto {
  id: string
  invoice_number: string
  order_id: string
  order_number_snapshot: string
  customer: {
    id: string
    customer_code: string | null
    business_name: string
    contact_person: string | null
    contact_number: string | null
    email: string | null
    address: string | null
  }
  status: InvoiceStatus
  subtotal: string
  items: InvoiceItemDto[]
  created_at: string
  updated_at: string
}

export function toInvoiceListItemDto(invoice: Invoice, user: SafeUser): InvoiceListItemDto {
  assertAdmin(user)

  return {
    id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    order_id: invoice.orderId,
    order_number_snapshot: invoice.orderNumberSnapshot,
    customer: {
      id: invoice.customerId,
      customer_code: invoice.customerCodeSnapshot ?? null,
      business_name: invoice.customerBusinessNameSnapshot,
    },
    status: invoice.status,
    subtotal: toMoneyString(invoice.subtotal),
    created_at: invoice.createdAt.toISOString(),
    updated_at: invoice.updatedAt.toISOString(),
  }
}

export function toInvoiceDto(invoice: InvoiceWithRelations, user: SafeUser): InvoiceDto {
  assertAdmin(user)

  return {
    id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    order_id: invoice.orderId,
    order_number_snapshot: invoice.orderNumberSnapshot,
    customer: {
      id: invoice.customerId,
      customer_code: invoice.customerCodeSnapshot ?? null,
      business_name: invoice.customerBusinessNameSnapshot,
      contact_person: invoice.customerContactPersonSnapshot ?? null,
      contact_number: invoice.customerContactNumberSnapshot ?? null,
      email: invoice.customerEmailSnapshot ?? null,
      address: invoice.customerAddressSnapshot ?? null,
    },
    status: invoice.status,
    subtotal: toMoneyString(invoice.subtotal),
    items: invoice.items.map((item) => ({
      id: item.id,
      order_line_item_id: item.orderItemId,
      item_type: item.itemType,
      description_snapshot: item.descriptionSnapshot,
      quantity: item.quantity,
      unit_price: toMoneyString(item.unitPrice),
      line_total: toMoneyString(item.lineTotal),
      created_at: item.createdAt.toISOString(),
    })),
    created_at: invoice.createdAt.toISOString(),
    updated_at: invoice.updatedAt.toISOString(),
  }
}

function toMoneyString(value: string): string {
  return Number(value).toFixed(2)
}
