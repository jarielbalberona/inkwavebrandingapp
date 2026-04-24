import test from "node:test"
import assert from "node:assert/strict"

import { AuthorizationError } from "../auth/authorization.js"
import {
  assertInvoiceAllowsStructuralChanges,
  InvoiceAlreadyExistsError,
  InvoiceAlreadyPaidError,
  InvoiceOrderCanceledError,
  InvoicePaymentLockError,
  InvoicePaymentOverpaymentError,
  InvoicePaymentVoidError,
  InvoicePaidLockError,
  InvoiceVoidAfterPaymentError,
  InvoiceVoidLockError,
  InvoicesService,
  syncInvoiceSnapshotForOrder,
} from "./invoices.service.js"

const adminUser = {
  id: "77777777-7777-7777-7777-777777777777",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin",
  permissions: [],
} as const

const staffUser = {
  id: "88888888-8888-8888-8888-888888888888",
  email: "staff@example.com",
  displayName: "Staff",
  role: "staff",
  permissions: [],
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
          totalAmount: "2400.00",
          paidAmount: "0.00",
          remainingBalance: "2400.00",
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
      totalAmount: string
      paidAmount: string
      remainingBalance: string
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
      totalAmount: "2400.00",
      paidAmount: "0.00",
      remainingBalance: "2400.00",
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
          totalAmount: "1150.00",
          paidAmount: "0.00",
          remainingBalance: "1150.00",
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
      totalAmount: string
      paidAmount: string
      remainingBalance: string
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
  assert.equal(createInput.invoice.totalAmount, "1150.00")
  assert.equal(createInput.invoice.paidAmount, "0.00")
  assert.equal(createInput.invoice.remainingBalance, "1150.00")
  assert.equal(dto.items[0]?.item_type, "custom_charge")
  assert.equal(dto.items[0]?.description_snapshot, "Rush fee")
  assert.equal(dto.items[0]?.line_total, "500.00")
  assert.equal(dto.subtotal, "1150.00")
  assert.equal(dto.status, "pending")
})

test("assertInvoiceAllowsStructuralChanges allows pending invoices", () => {
  assert.doesNotThrow(() => assertInvoiceAllowsStructuralChanges({ status: "pending", paidAmount: "0.00" }))
})

test("assertInvoiceAllowsStructuralChanges rejects paid invoices", () => {
  assert.throws(
    () => assertInvoiceAllowsStructuralChanges({ status: "paid", paidAmount: "100.00" }),
    InvoicePaidLockError,
  )
})

test("assertInvoiceAllowsStructuralChanges rejects void invoices", () => {
  assert.throws(
    () => assertInvoiceAllowsStructuralChanges({ status: "void", paidAmount: "0.00" }),
    InvoiceVoidLockError,
  )
})

test("assertInvoiceAllowsStructuralChanges rejects invoices with recorded payments", () => {
  assert.throws(
    () => assertInvoiceAllowsStructuralChanges({ status: "pending", paidAmount: "1.00" }),
    InvoicePaymentLockError,
  )
})

test("recordPayment persists a partial payment and keeps the invoice pending", async () => {
  const recordedPayments: unknown[] = []
  let financialStateUpdate: unknown = null
  let currentInvoice = {
    id: "invoice-1",
    invoiceNumber: "INV-20260424-PAY0001",
    orderId: "order-1",
    orderNumberSnapshot: "ORD-001",
    customerId: "customer-1",
    customerCodeSnapshot: "CUST-001",
    customerBusinessNameSnapshot: "Ink Wave Cafe",
    customerContactPersonSnapshot: "Jane Doe",
    customerContactNumberSnapshot: "09170000000",
    customerEmailSnapshot: "jane@example.com",
    customerAddressSnapshot: "Manila",
    status: "pending" as const,
    subtotal: "1000.00",
    totalAmount: "1000.00",
    paidAmount: "0.00",
    remainingBalance: "1000.00",
    createdAt: new Date("2026-04-24T00:00:00.000Z"),
    updatedAt: new Date("2026-04-24T00:00:00.000Z"),
    items: [],
    payments: [],
  }

  const invoicesRepository = {
    transaction: async (handler: (context: { invoicesRepository: unknown; db: unknown }) => Promise<unknown>) =>
      handler({ invoicesRepository, db: {} }),
    findByIdWithRelations: async () => currentInvoice,
    createPayment: async (input: unknown) => {
      recordedPayments.push(input)
      currentInvoice = {
        ...currentInvoice,
        payments: [
          {
            id: "payment-1",
            invoiceId: "invoice-1",
            amount: "250.00",
            paymentDate: new Date("2026-04-24T08:00:00.000Z"),
            note: "Initial deposit",
            createdByUserId: adminUser.id,
            createdAt: new Date("2026-04-24T08:00:00.000Z"),
            updatedAt: new Date("2026-04-24T08:00:00.000Z"),
            createdByUser: {
              id: adminUser.id,
              email: adminUser.email,
              displayName: adminUser.displayName,
            },
          },
        ],
      }

      return null
    },
    updateFinancialState: async (_invoiceId: string, input: unknown) => {
      financialStateUpdate = input
      currentInvoice = {
        ...currentInvoice,
        ...(input as Record<string, unknown>),
      }
    },
  }

  const service = new InvoicesService(invoicesRepository as never, {} as never)

  const invoice = await service.recordPayment(
    "invoice-1",
    {
      amount: "250.00",
      payment_date: new Date("2026-04-24T08:00:00.000Z"),
      note: "Initial deposit",
    },
    adminUser,
  )

  assert.deepEqual(recordedPayments, [
    {
      invoiceId: "invoice-1",
      payment: {
        amount: "250.00",
        paymentDate: new Date("2026-04-24T08:00:00.000Z"),
        note: "Initial deposit",
        createdByUserId: adminUser.id,
      },
    },
  ])
  assert.deepEqual(financialStateUpdate, {
    status: "pending",
    paidAmount: "250.00",
    remainingBalance: "750.00",
  })
  assert.equal(invoice.status, "pending")
  assert.equal(invoice.paid_amount, "250.00")
  assert.equal(invoice.remaining_balance, "750.00")
  assert.equal(invoice.payments.length, 1)
  assert.equal(invoice.payments[0]?.amount, "250.00")
  assert.equal(invoice.payments[0]?.created_by?.id, adminUser.id)
})

test("recordPayment settles the invoice when the remaining balance is paid exactly", async () => {
  let updatedState: unknown = null
  let currentInvoice = {
    id: "invoice-1",
    invoiceNumber: "INV-20260424-PAY0002",
    orderId: "order-1",
    orderNumberSnapshot: "ORD-001",
    customerId: "customer-1",
    customerCodeSnapshot: "CUST-001",
    customerBusinessNameSnapshot: "Ink Wave Cafe",
    customerContactPersonSnapshot: "Jane Doe",
    customerContactNumberSnapshot: "09170000000",
    customerEmailSnapshot: "jane@example.com",
    customerAddressSnapshot: "Manila",
    status: "pending" as const,
    subtotal: "1000.00",
    totalAmount: "1000.00",
    paidAmount: "400.00",
    remainingBalance: "600.00",
    createdAt: new Date("2026-04-24T00:00:00.000Z"),
    updatedAt: new Date("2026-04-24T00:00:00.000Z"),
    items: [],
    payments: [],
  }

  const invoicesRepository = {
    transaction: async (handler: (context: { invoicesRepository: unknown; db: unknown }) => Promise<unknown>) =>
      handler({ invoicesRepository, db: {} }),
    findByIdWithRelations: async () => currentInvoice,
    createPayment: async () => null,
    updateFinancialState: async (_invoiceId: string, input: unknown) => {
      updatedState = input
      currentInvoice = {
        ...currentInvoice,
        ...(input as Record<string, unknown>),
      }
    },
  }

  const service = new InvoicesService(invoicesRepository as never, {} as never)

  const invoice = await service.recordPayment(
    "invoice-1",
    {
      amount: "600.00",
      payment_date: new Date("2026-04-24T08:00:00.000Z"),
    },
    adminUser,
  )

  assert.deepEqual(updatedState, {
    status: "paid",
    paidAmount: "1000.00",
    remainingBalance: "0.00",
  })
  assert.equal(invoice.status, "paid")
  assert.equal(invoice.paid_amount, "1000.00")
  assert.equal(invoice.remaining_balance, "0.00")
})

test("recordPayment rejects overpayment", async () => {
  const service = new InvoicesService(
    {
      transaction: async (handler: (context: { invoicesRepository: unknown; db: unknown }) => Promise<unknown>) =>
        handler({
          invoicesRepository: {
            findByIdWithRelations: async () => ({
              id: "invoice-1",
              status: "pending",
              totalAmount: "1000.00",
              paidAmount: "200.00",
              remainingBalance: "800.00",
            }),
          },
          db: {},
        }),
    } as never,
    {} as never,
  )

  await assert.rejects(
    () =>
      service.recordPayment(
        "invoice-1",
        {
          amount: "900.00",
          payment_date: new Date("2026-04-24T08:00:00.000Z"),
        },
        adminUser,
      ),
    InvoicePaymentOverpaymentError,
  )
})

test("recordPayment rejects void invoices", async () => {
  const service = new InvoicesService(
    {
      transaction: async (handler: (context: { invoicesRepository: unknown; db: unknown }) => Promise<unknown>) =>
        handler({
          invoicesRepository: {
            findByIdWithRelations: async () => ({
              id: "invoice-1",
              status: "void",
              totalAmount: "1000.00",
              paidAmount: "0.00",
              remainingBalance: "1000.00",
            }),
          },
          db: {},
        }),
    } as never,
    {} as never,
  )

  await assert.rejects(
    () =>
      service.recordPayment(
        "invoice-1",
        {
          amount: "100.00",
          payment_date: new Date("2026-04-24T08:00:00.000Z"),
        },
        adminUser,
      ),
    InvoicePaymentVoidError,
  )
})

test("recordPayment rejects already paid invoices", async () => {
  const service = new InvoicesService(
    {
      transaction: async (handler: (context: { invoicesRepository: unknown; db: unknown }) => Promise<unknown>) =>
        handler({
          invoicesRepository: {
            findByIdWithRelations: async () => ({
              id: "invoice-1",
              status: "paid",
              totalAmount: "1000.00",
              paidAmount: "1000.00",
              remainingBalance: "0.00",
            }),
          },
          db: {},
        }),
    } as never,
    {} as never,
  )

  await assert.rejects(
    () =>
      service.recordPayment(
        "invoice-1",
        {
          amount: "100.00",
          payment_date: new Date("2026-04-24T08:00:00.000Z"),
        },
        adminUser,
      ),
    InvoiceAlreadyPaidError,
  )
})

test("recordPayment rejects staff access", async () => {
  const service = new InvoicesService({} as never, {} as never)

  await assert.rejects(
    () =>
      service.recordPayment(
        "invoice-1",
        {
          amount: "100.00",
          payment_date: new Date("2026-04-24T08:00:00.000Z"),
        },
        staffUser,
      ),
    AuthorizationError,
  )
})

test("void marks an unpaid invoice as void", async () => {
  let updatedState: unknown = null
  let currentInvoice = {
    id: "invoice-1",
    invoiceNumber: "INV-20260424-VOID0001",
    orderId: "order-1",
    orderNumberSnapshot: "ORD-001",
    customerId: "customer-1",
    customerCodeSnapshot: "CUST-001",
    customerBusinessNameSnapshot: "Ink Wave Cafe",
    customerContactPersonSnapshot: "Jane Doe",
    customerContactNumberSnapshot: "09170000000",
    customerEmailSnapshot: "jane@example.com",
    customerAddressSnapshot: "Manila",
    status: "pending" as const,
    subtotal: "1000.00",
    totalAmount: "1000.00",
    paidAmount: "0.00",
    remainingBalance: "1000.00",
    createdAt: new Date("2026-04-24T00:00:00.000Z"),
    updatedAt: new Date("2026-04-24T00:00:00.000Z"),
    items: [],
    payments: [],
  }

  const invoicesRepository = {
    transaction: async (handler: (context: { invoicesRepository: unknown; db: unknown }) => Promise<unknown>) =>
      handler({ invoicesRepository, db: {} }),
    findByIdWithRelations: async () => currentInvoice,
    updateFinancialState: async (_invoiceId: string, input: unknown) => {
      updatedState = input
      currentInvoice = {
        ...currentInvoice,
        ...(input as Record<string, unknown>),
      }
    },
  }

  const service = new InvoicesService(invoicesRepository as never, {} as never)

  const invoice = await service.void("invoice-1", adminUser)

  assert.deepEqual(updatedState, {
    status: "void",
    paidAmount: "0.00",
    remainingBalance: "1000.00",
  })
  assert.equal(invoice.status, "void")
  assert.equal(invoice.paid_amount, "0.00")
  assert.equal(invoice.remaining_balance, "1000.00")
})

test("void rejects invoices with recorded payments", async () => {
  const service = new InvoicesService(
    {
      transaction: async (handler: (context: { invoicesRepository: unknown; db: unknown }) => Promise<unknown>) =>
        handler({
          invoicesRepository: {
            findByIdWithRelations: async () => ({
              id: "invoice-1",
              status: "pending",
              totalAmount: "1000.00",
              paidAmount: "100.00",
              remainingBalance: "900.00",
            }),
          },
          db: {},
        }),
    } as never,
    {} as never,
  )

  await assert.rejects(() => service.void("invoice-1", adminUser), InvoiceVoidAfterPaymentError)
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
          totalAmount: "240.00",
          paidAmount: "0.00",
          remainingBalance: "240.00",
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
      totalAmount: string
      paidAmount: string
      remainingBalance: string
    }
  }

  assert.equal(createInput.invoice.orderId, "order-3")
  assert.equal(createInput.invoice.status, "pending")
  assert.equal(createInput.invoice.createdByUserId, adminUser.id)
  assert.equal(createInput.invoice.subtotal, "240.00")
  assert.equal(createInput.invoice.totalAmount, "240.00")
  assert.equal(createInput.invoice.paidAmount, "0.00")
  assert.equal(createInput.invoice.remainingBalance, "240.00")
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
          totalAmount: "325.00",
          paidAmount: "0.00",
          remainingBalance: "325.00",
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
      totalAmount: string
      remainingBalance: string
      customerAddressSnapshot: string | null
    }
    items: Array<{
      orderItemId: string
      lineTotal: string
    }>
  }

  assert.equal(replaceInput.invoiceId, "invoice-existing")
  assert.equal(replaceInput.invoice.subtotal, "325.00")
  assert.equal(replaceInput.invoice.totalAmount, "325.00")
  assert.equal(replaceInput.invoice.remainingBalance, "325.00")
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
