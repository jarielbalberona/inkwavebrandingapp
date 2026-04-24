import test from "node:test"
import assert from "node:assert/strict"

import { AuthorizationError } from "../auth/authorization.js"
import {
  InvoiceAlreadyExistsError,
  InvoiceOrderNotCompletedError,
  InvoicesService,
} from "./invoices.service.js"

const adminUser = {
  id: "77777777-7777-7777-7777-777777777777",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin",
} as const

const staffUser = {
  id: "88888888-8888-8888-8888-888888888888",
  email: "staff@example.com",
  displayName: "Staff",
  role: "staff",
} as const

test("generateForOrder rejects staff access", async () => {
  const service = new InvoicesService(
    {
      findByOrderId: async () => null,
    } as never,
    {
      findByIdWithRelations: async () => null,
    } as never,
  )

  await assert.rejects(() => service.generateForOrder("order-1", staffUser), AuthorizationError)
})

test("generateForOrder rejects duplicate invoices for the same order", async () => {
  const service = new InvoicesService(
    {
      findByOrderId: async () => ({ id: "existing-invoice" }),
    } as never,
    {
      findByIdWithRelations: async () => {
        throw new Error("orders repository should not be reached when invoice already exists")
      },
    } as never,
  )

  await assert.rejects(() => service.generateForOrder("order-1", adminUser), InvoiceAlreadyExistsError)
})

test("generateForOrder rejects orders that are not completed", async () => {
  const service = new InvoicesService(
    {
      findByOrderId: async () => null,
    } as never,
    {
      findByIdWithRelations: async () => ({
        id: "order-1",
        status: "pending",
      }),
    } as never,
  )

  await assert.rejects(() => service.generateForOrder("order-1", adminUser), InvoiceOrderNotCompletedError)
})

test("generateForOrder snapshots order sell pricing and subtotal into the invoice", async () => {
  let capturedInput: unknown

  const service = new InvoicesService(
    {
      findByOrderId: async () => null,
      createInvoiceWithItems: async (input: unknown) => {
        capturedInput = input

        return {
          id: "99999999-9999-9999-9999-999999999999",
          invoiceNumber: "INV-20260424-ACBBD9C8",
          orderId: "order-1",
          orderNumberSnapshot: "ORD-001",
          customerId: "customer-1",
          customerCodeSnapshot: "CUST-001",
          customerBusinessNameSnapshot: "Ink Wave Cafe",
          customerContactPersonSnapshot: "Jane Doe",
          customerContactNumberSnapshot: "09170000000",
          customerEmailSnapshot: "jane@example.com",
          customerAddressSnapshot: "Manila",
          subtotal: "2400.00",
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-24T00:00:00.000Z"),
          items: [
            {
              id: "item-1",
              orderItemId: "line-1",
              itemType: "cup",
              descriptionSnapshot: "12oz kraft paper cup",
              quantity: 100,
              unitPrice: "15.00",
              lineTotal: "1500.00",
              createdAt: new Date("2026-04-24T00:00:00.000Z"),
            },
            {
              id: "item-2",
              orderItemId: "line-2",
              itemType: "lid",
              descriptionSnapshot: "80mm coffee lid",
              quantity: 180,
              unitPrice: "5.00",
              lineTotal: "900.00",
              createdAt: new Date("2026-04-24T00:00:00.000Z"),
            },
          ],
        }
      },
    } as never,
    {
      findByIdWithRelations: async () => ({
        id: "order-1",
        orderNumber: "ORD-001",
        status: "completed",
        customer: {
          id: "customer-1",
          customerCode: "CUST-001",
          businessName: "Ink Wave Cafe",
          contactPerson: "Jane Doe",
          contactNumber: "09170000000",
          email: "jane@example.com",
          address: "Manila",
        },
        items: [
          {
            id: "line-1",
            itemType: "cup",
            descriptionSnapshot: "12oz kraft paper cup",
            quantity: 100,
            unitSellPrice: "15.00",
          },
          {
            id: "line-2",
            itemType: "lid",
            descriptionSnapshot: "80mm coffee lid",
            quantity: 180,
            unitSellPrice: "5.00",
          },
        ],
      }),
    } as never,
  )

  const dto = await service.generateForOrder("order-1", adminUser)

  assert.match(dto.invoice_number, /^INV-\d{8}-[A-F0-9]{8}$/)
  assert.equal(typeof capturedInput, "object")

  const createInput = capturedInput as {
    invoice: {
      invoiceNumber: string
      orderId: string
      orderNumberSnapshot: string
      customerId: string
      customerCodeSnapshot: string
      customerBusinessNameSnapshot: string
      customerContactPersonSnapshot: string
      customerContactNumberSnapshot: string
      customerEmailSnapshot: string
      customerAddressSnapshot: string
      subtotal: string
      createdByUserId: string
    }
    items: Array<{
      orderItemId: string
      itemType: "cup" | "lid"
      descriptionSnapshot: string
      quantity: number
      unitPrice: string
      lineTotal: string
    }>
  }

  assert.match(createInput.invoice.invoiceNumber, /^INV-\d{8}-[A-F0-9]{8}$/)

  assert.deepEqual(
    {
      ...createInput,
      invoice: {
        ...createInput.invoice,
        invoiceNumber: "<generated>",
      },
    },
    {
    invoice: {
      invoiceNumber: "<generated>",
      orderId: "order-1",
      orderNumberSnapshot: "ORD-001",
      customerId: "customer-1",
      customerCodeSnapshot: "CUST-001",
      customerBusinessNameSnapshot: "Ink Wave Cafe",
      customerContactPersonSnapshot: "Jane Doe",
      customerContactNumberSnapshot: "09170000000",
      customerEmailSnapshot: "jane@example.com",
      customerAddressSnapshot: "Manila",
      subtotal: "2400.00",
      createdByUserId: adminUser.id,
    },
    items: [
      {
        orderItemId: "line-1",
        itemType: "cup",
        descriptionSnapshot: "12oz kraft paper cup",
        quantity: 100,
        unitPrice: "15.00",
        lineTotal: "1500.00",
      },
      {
        orderItemId: "line-2",
        itemType: "lid",
        descriptionSnapshot: "80mm coffee lid",
        quantity: 180,
        unitPrice: "5.00",
        lineTotal: "900.00",
      },
    ],
    },
  )

  assert.equal(dto.subtotal, "2400.00")
  assert.equal(dto.items[0]?.line_total, "1500.00")
  assert.equal(dto.items[1]?.line_total, "900.00")
})

test("generateForOrder includes custom_charge lines without any master-data dependency", async () => {
  let capturedInput: unknown

  const service = new InvoicesService(
    {
      findByOrderId: async () => null,
      createInvoiceWithItems: async (input: unknown) => {
        capturedInput = input

        return {
          id: "99999999-9999-9999-9999-999999999999",
          invoiceNumber: "INV-20260424-CUSTOM01",
          orderId: "order-2",
          orderNumberSnapshot: "ORD-002",
          customerId: "customer-1",
          customerCodeSnapshot: "CUST-001",
          customerBusinessNameSnapshot: "Ink Wave Cafe",
          customerContactPersonSnapshot: "Jane Doe",
          customerContactNumberSnapshot: "09170000000",
          customerEmailSnapshot: "jane@example.com",
          customerAddressSnapshot: "Manila",
          subtotal: "1150.00",
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-24T00:00:00.000Z"),
          items: [
            {
              id: "item-1",
              orderItemId: "line-1",
              itemType: "custom_charge",
              descriptionSnapshot: "Rush fee",
              quantity: 1,
              unitPrice: "500.00",
              lineTotal: "500.00",
              createdAt: new Date("2026-04-24T00:00:00.000Z"),
            },
            {
              id: "item-2",
              orderItemId: "line-2",
              itemType: "non_stock_item",
              descriptionSnapshot: "Screen printing mold",
              quantity: 1,
              unitPrice: "650.00",
              lineTotal: "650.00",
              createdAt: new Date("2026-04-24T00:00:00.000Z"),
            },
          ],
        }
      },
    } as never,
    {
      findByIdWithRelations: async () => ({
        id: "order-2",
        orderNumber: "ORD-002",
        status: "completed",
        customer: {
          id: "customer-1",
          customerCode: "CUST-001",
          businessName: "Ink Wave Cafe",
          contactPerson: "Jane Doe",
          contactNumber: "09170000000",
          email: "jane@example.com",
          address: "Manila",
        },
        items: [
          {
            id: "line-1",
            itemType: "custom_charge",
            descriptionSnapshot: "Rush fee",
            quantity: 1,
            unitSellPrice: "500.00",
          },
          {
            id: "line-2",
            itemType: "non_stock_item",
            descriptionSnapshot: "Screen printing mold",
            quantity: 1,
            unitSellPrice: "650.00",
          },
        ],
      }),
    } as never,
  )

  const dto = await service.generateForOrder("order-2", adminUser)

  const createInput = capturedInput as {
    items: Array<{
      orderItemId: string
      itemType: "cup" | "lid" | "non_stock_item" | "custom_charge"
      descriptionSnapshot: string
      quantity: number
      unitPrice: string
      lineTotal: string
    }>
    invoice: {
      subtotal: string
    }
  }

  assert.deepEqual(createInput.items, [
    {
      orderItemId: "line-1",
      itemType: "custom_charge",
      descriptionSnapshot: "Rush fee",
      quantity: 1,
      unitPrice: "500.00",
      lineTotal: "500.00",
    },
    {
      orderItemId: "line-2",
      itemType: "non_stock_item",
      descriptionSnapshot: "Screen printing mold",
      quantity: 1,
      unitPrice: "650.00",
      lineTotal: "650.00",
    },
  ])
  assert.equal(createInput.invoice.subtotal, "1150.00")
  assert.equal(dto.items[0]?.item_type, "custom_charge")
  assert.equal(dto.items[0]?.description_snapshot, "Rush fee")
  assert.equal(dto.items[0]?.line_total, "500.00")
  assert.equal(dto.subtotal, "1150.00")
})
