import assert from "node:assert/strict"
import test from "node:test"

import type { RetrievedObject, StoredObject } from "../../lib/storage/object-storage.types.js"
import { InvoiceDocumentsService } from "./invoice-documents.service.js"

const adminUser = {
  id: "77777777-7777-7777-7777-777777777777",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin",
} as const

test("InvoiceDocumentsService renders inline PDF when storage is disabled", async () => {
  let assetCreated = false

  const service = new InvoiceDocumentsService(
    {
      findByIdWithRelations: async () => buildInvoiceRecord(),
    } as never,
    {
      create: async () => {
        assetCreated = true
        throw new Error("assets repository should not be used when storage is disabled")
      },
    } as never,
    {
      provider: "none",
      maxFileBytes: 5 * 1024 * 1024,
      maxRequestBytes: 50 * 1024 * 1024,
      r2: null,
    },
    null,
  )

  const document = await service.getPdfDocument("invoice-1", adminUser)

  assert.equal(document.contentType, "application/pdf")
  assert.equal(document.filename, "INV-20260424-TEST0001.pdf")
  assert.ok(document.body.byteLength > 0)
  assert.equal(document.body.subarray(0, 4).toString("utf8"), "%PDF")
  assert.equal(assetCreated, false)
})

test("InvoiceDocumentsService stores a new private invoice PDF asset when R2 is enabled", async () => {
  let createdAssetInput: unknown
  let linkedDocumentAsset: { invoiceId: string; assetId: string | null } | null = null
  let uploadedObjectInput: unknown

  const storageProvider = {
    putObject: async (input: unknown): Promise<StoredObject> => {
      uploadedObjectInput = input

      const typedInput = input as { objectKey: string; contentType: string; contentLength: number; visibility: "private" | "public" }

      return {
        objectKey: typedInput.objectKey,
        contentType: typedInput.contentType,
        contentLength: typedInput.contentLength,
        visibility: typedInput.visibility,
        publicUrl: null,
      }
    },
    getObject: async (): Promise<RetrievedObject> => {
      throw new Error("getObject should not be used for a brand new asset")
    },
    deleteObject: async () => {
      throw new Error("deleteObject should not be used for a brand new asset")
    },
    getPublicUrl: () => null,
  }

  const service = new InvoiceDocumentsService(
    {
      findByIdWithRelations: async () => buildInvoiceRecord(),
      setDocumentAssetId: async (invoiceId: string, assetId: string | null) => {
        linkedDocumentAsset = { invoiceId, assetId }
      },
    } as never,
    {
      create: async (input: unknown) => {
        createdAssetInput = input
        const typedInput = input as Record<string, unknown>

        return {
          id: "asset-1",
          ...typedInput,
          createdAt: new Date("2026-04-24T10:10:00.000Z"),
          updatedAt: new Date("2026-04-24T10:10:00.000Z"),
        }
      },
    } as never,
    {
      provider: "r2",
      maxFileBytes: 5 * 1024 * 1024,
      maxRequestBytes: 50 * 1024 * 1024,
      r2: {
        accountId: "acct",
        accessKeyId: "key",
        secretAccessKey: "secret",
        bucketName: "bucket",
        endpoint: "https://acct.r2.cloudflarestorage.com",
        publicUrl: "https://cdn.example.com",
        usePublicCdn: false,
      },
    },
    storageProvider,
  )

  const document = await service.getPdfDocument("invoice-1", adminUser)

  assert.equal(document.contentType, "application/pdf")
  assert.ok(document.body.byteLength > 0)
  assert.equal(typeof uploadedObjectInput, "object")
  assert.match((uploadedObjectInput as { objectKey: string }).objectKey, /^invoices\/invoice-1\/pdf\/\d+-[a-f0-9]{16}\.pdf$/)
  assert.deepEqual(linkedDocumentAsset, {
    invoiceId: "invoice-1",
    assetId: "asset-1",
  })
  assert.equal((createdAssetInput as { kind: string }).kind, "invoice_pdf")
  assert.equal((createdAssetInput as { visibility: string }).visibility, "private")
})

test("InvoiceDocumentsService reuses the stored PDF when the linked asset is newer than the invoice", async () => {
  let uploaded = false

  const service = new InvoiceDocumentsService(
    {
      findByIdWithRelations: async () =>
        buildInvoiceRecord({
          documentAsset: {
            id: "asset-1",
            kind: "invoice_pdf",
            storageProvider: "r2",
            visibility: "private",
            objectKey: "invoices/invoice-1/pdf/current.pdf",
            publicUrl: null,
            filename: "INV-20260424-TEST0001.pdf",
            contentType: "application/pdf",
            sizeBytes: 123,
            createdAt: new Date("2026-04-24T10:10:00.000Z"),
            updatedAt: new Date("2026-04-24T10:10:00.000Z"),
          },
          updatedAt: new Date("2026-04-24T10:00:00.000Z"),
        }),
    } as never,
    {} as never,
    {
      provider: "r2",
      maxFileBytes: 5 * 1024 * 1024,
      maxRequestBytes: 50 * 1024 * 1024,
      r2: {
        accountId: "acct",
        accessKeyId: "key",
        secretAccessKey: "secret",
        bucketName: "bucket",
        endpoint: "https://acct.r2.cloudflarestorage.com",
        publicUrl: null,
        usePublicCdn: false,
      },
    },
    {
      putObject: async () => {
        uploaded = true
        throw new Error("putObject should not be used when the stored asset is fresh")
      },
      getObject: async () => ({
        body: Buffer.from("stored-pdf"),
        contentType: "application/pdf",
        contentLength: 10,
      }),
      deleteObject: async () => {
        throw new Error("deleteObject should not be used when reusing the current asset")
      },
      getPublicUrl: () => null,
    },
  )

  const document = await service.getPdfDocument("invoice-1", adminUser)

  assert.equal(document.body.toString("utf8"), "stored-pdf")
  assert.equal(document.filename, "INV-20260424-TEST0001.pdf")
  assert.equal(uploaded, false)
})

function buildInvoiceRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...baseInvoiceRecord(),
    ...overrides,
  }
}

function baseInvoiceRecord() {
  return {
    id: "invoice-1",
    invoiceNumber: "INV-20260424-TEST0001",
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
    subtotal: "1500.00",
    documentAssetId: null,
    createdByUserId: adminUser.id,
    createdAt: new Date("2026-04-24T09:00:00.000Z"),
    updatedAt: new Date("2026-04-24T09:00:00.000Z"),
    documentAsset: null,
    items: [
      {
        id: "item-1",
        invoiceId: "invoice-1",
        orderItemId: "order-item-1",
        itemType: "cup" as const,
        descriptionSnapshot: "12oz kraft paper cup",
        quantity: 100,
        unitPrice: "15.00",
        lineTotal: "1500.00",
        createdAt: new Date("2026-04-24T09:00:00.000Z"),
        orderItem: {
          id: "order-item-1",
        },
      },
    ],
  }
}
