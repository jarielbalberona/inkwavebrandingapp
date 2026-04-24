import test from "node:test"
import assert from "node:assert/strict"

import { AuthorizationError } from "../auth/authorization.js"
import {
  assertInvoiceAllowsStructuralChanges,
  InvoiceAlreadyExistsError,
  InvoiceOrderCanceledError,
  InvoicePaidLockError,
  InvoiceVoidLockError,
  InvoicesService,
  syncInvoiceSnapshotForOrder,
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

test("generateForOrder rejects canceled orders", async () => {
  const service = new InvoicesService(
    {
      findByOrderId: async () => null,
    } as never,
    {
      findByIdWithRelations: async () => ({
        id: "order-1",
        status: "canceled",
      }),
    } as never,
  )

  await assert.rejects(() => service.generateForOrder("order-1", adminUser), InvoiceOrderCanceledError)
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
          status: "pending",
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
        status: "pending",
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
      status: "pending" | "paid" | "void"
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
      status: "pending",
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
  assert.equal(dto.status, "pending")
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
          status: "pending",
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
        status: "pending",
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
      status: "pending" | "paid" | "void"
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
  assert.equal(createInput.invoice.status, "pending")
  assert.equal(createInput.invoice.subtotal, "1150.00")
  assert.equal(dto.items[0]?.item_type, "custom_charge")
  assert.equal(dto.items[0]?.description_snapshot, "Rush fee")
  assert.equal(dto.items[0]?.line_total, "500.00")
  assert.equal(dto.subtotal, "1150.00")
  assert.equal(dto.status, "pending")
})

test("assertInvoiceAllowsStructuralChanges allows pending invoices", () => {
  assert.doesNotThrow(() => assertInvoiceAllowsStructuralChanges("pending"))
})

test("assertInvoiceAllowsStructuralChanges rejects paid invoices", () => {
  assert.throws(() => assertInvoiceAllowsStructuralChanges("paid"), InvoicePaidLockError)
})

test("assertInvoiceAllowsStructuralChanges rejects void invoices", () => {
  assert.throws(() => assertInvoiceAllowsStructuralChanges("void"), InvoiceVoidLockError)
})

test("syncInvoiceSnapshotForOrder creates a pending invoice when one does not exist", async () => {
  let capturedInput: unknown

  const invoice = await syncInvoiceSnapshotForOrder(
    {
      findByOrderId: async () => null,
      createInvoiceWithItems: async (input: unknown) => {
        capturedInput = input

        return {
          id: "invoice-1",
          invoiceNumber: "INV-20260424-NEW00001",
          orderId: "order-3",
          orderNumberSnapshot: "ORD-003",
          customerId: "customer-1",
          customerCodeSnapshot: "CUST-001",
          customerBusinessNameSnapshot: "Ink Wave Cafe",
          customerContactPersonSnapshot: "Jane Doe",
          customerContactNumberSnapshot: "09170000000",
          customerEmailSnapshot: "jane@example.com",
          customerAddressSnapshot: "Manila",
          status: "pending",
          subtotal: "240.00",
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-24T00:00:00.000Z"),
          items: [],
        }
      },
      replaceInvoiceSnapshotWithItems: async () => {
        throw new Error("replace should not run when invoice is missing")
      },
    } as never,
    {
      id: "order-3",
      orderNumber: "ORD-003",
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
          quantity: 16,
          unitSellPrice: "15.00",
        },
      ],
    },
    adminUser.id,
  )

  const createInput = capturedInput as {
    invoice: {
      orderId: string
      status: "pending" | "paid" | "void"
      createdByUserId: string
      subtotal: string
    }
  }

  assert.equal(createInput.invoice.orderId, "order-3")
  assert.equal(createInput.invoice.status, "pending")
  assert.equal(createInput.invoice.createdByUserId, adminUser.id)
  assert.equal(createInput.invoice.subtotal, "240.00")
  assert.equal(invoice.id, "invoice-1")
})

test("syncInvoiceSnapshotForOrder replaces the same invoice record when it already exists and is unpaid", async () => {
  let replacedInput: unknown

  const invoice = await syncInvoiceSnapshotForOrder(
    {
      findByOrderId: async () => ({
        id: "invoice-existing",
        status: "pending",
      }),
      createInvoiceWithItems: async () => {
        throw new Error("create should not run when invoice already exists")
      },
      replaceInvoiceSnapshotWithItems: async (input: unknown) => {
        replacedInput = input

        return {
          id: "invoice-existing",
          invoiceNumber: "INV-20260424-EXIST001",
          orderId: "order-4",
          orderNumberSnapshot: "ORD-004",
          customerId: "customer-1",
          customerCodeSnapshot: "CUST-001",
          customerBusinessNameSnapshot: "Ink Wave Cafe",
          customerContactPersonSnapshot: "Jane Doe",
          customerContactNumberSnapshot: "09170000000",
          customerEmailSnapshot: "jane@example.com",
          customerAddressSnapshot: "Updated Address",
          status: "pending",
          subtotal: "325.00",
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-24T01:00:00.000Z"),
          items: [],
        }
      },
    } as never,
    {
      id: "order-4",
      orderNumber: "ORD-004",
      customer: {
        id: "customer-1",
        customerCode: "CUST-001",
        businessName: "Ink Wave Cafe",
        contactPerson: "Jane Doe",
        contactNumber: "09170000000",
        email: "jane@example.com",
        address: "Updated Address",
      },
      items: [
        {
          id: "line-1",
          itemType: "custom_charge",
          descriptionSnapshot: "Rush fee",
          quantity: 1,
          unitSellPrice: "325.00",
        },
      ],
    },
    adminUser.id,
  )

  const replaceInput = replacedInput as {
    invoiceId: string
    invoice: {
      subtotal: string
      customerAddressSnapshot: string | null
    }
    items: Array<{
      orderItemId: string
      lineTotal: string
    }>
  }

  assert.equal(replaceInput.invoiceId, "invoice-existing")
  assert.equal(replaceInput.invoice.subtotal, "325.00")
  assert.equal(replaceInput.invoice.customerAddressSnapshot, "Updated Address")
  assert.deepEqual(replaceInput.items, [
    {
      orderItemId: "line-1",
      itemType: "custom_charge",
      descriptionSnapshot: "Rush fee",
      quantity: 1,
      unitPrice: "325.00",
      lineTotal: "325.00",
    },
  ])
  assert.equal(invoice.id, "invoice-existing")
})

test("syncInvoiceSnapshotForOrder rejects paid invoices", async () => {
  await assert.rejects(
    () =>
      syncInvoiceSnapshotForOrder(
        {
          findByOrderId: async () => ({
            id: "invoice-locked",
            status: "paid",
          }),
          createInvoiceWithItems: async () => {
            throw new Error("create should not run when invoice is locked")
          },
          replaceInvoiceSnapshotWithItems: async () => {
            throw new Error("replace should not run when invoice is locked")
          },
        } as never,
        {
          id: "order-5",
          orderNumber: "ORD-005",
          customer: {
            id: "customer-1",
            customerCode: "CUST-001",
            businessName: "Ink Wave Cafe",
            contactPerson: null,
            contactNumber: null,
            email: null,
            address: null,
          },
          items: [],
        },
        adminUser.id,
      ),
    InvoicePaidLockError,
  )
})
