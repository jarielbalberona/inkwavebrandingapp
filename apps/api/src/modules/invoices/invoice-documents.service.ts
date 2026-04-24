import { renderInvoicePdf, type InvoicePdfData } from "@workspace/pdfs/server"

import { loadStorageConfig, type StorageConfig } from "../../config/storage.js"
import { createObjectStorageProvider } from "../../lib/storage/object-storage.provider.js"
import { buildInvoicePdfObjectKey } from "../../lib/storage/object-keys.js"
import { logError, serializeError } from "../../lib/logger.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { assertAdmin } from "../auth/authorization.js"
import { AssetsRepository } from "../assets/assets.repository.js"
import { InvoiceNotFoundError } from "./invoices.service.js"
import { InvoicesRepository } from "./invoices.repository.js"
import { toInvoiceDto } from "./invoices.types.js"

export class InvoiceDocumentsService {
  constructor(
    private readonly invoicesRepository: InvoicesRepository,
    private readonly assetsRepository: AssetsRepository,
    private readonly storageConfig: StorageConfig,
  ) {}

  static fromEnv(
    invoicesRepository: InvoicesRepository,
    assetsRepository: AssetsRepository,
    env: Parameters<typeof loadStorageConfig>[0],
  ) {
    return new InvoiceDocumentsService(invoicesRepository, assetsRepository, loadStorageConfig(env))
  }

  async getPdfDocument(invoiceId: string, user: SafeUser) {
    assertAdmin(user)

    const invoice = await this.invoicesRepository.findByIdWithRelations(invoiceId)

    if (!invoice) {
      throw new InvoiceNotFoundError()
    }

    const invoiceDto = toInvoiceDto(invoice, user)
    const filename = `${invoiceDto.invoice_number}.pdf`
    const storageProvider = createObjectStorageProvider(this.storageConfig)

    if (!storageProvider) {
      const pdfBuffer = await renderInvoicePdf(toInvoicePdfData(invoiceDto))

      return {
        body: pdfBuffer,
        contentType: "application/pdf",
        contentLength: pdfBuffer.byteLength,
        filename,
      }
    }

    const currentAsset = invoice.documentAsset ?? null

    if (currentAsset && currentAsset.updatedAt >= invoice.updatedAt) {
      try {
        const storedObject = await storageProvider.getObject(currentAsset.objectKey)

        return {
          body: storedObject.body,
          contentType: storedObject.contentType ?? "application/pdf",
          contentLength: storedObject.contentLength ?? storedObject.body.byteLength,
          filename: currentAsset.filename,
        }
      } catch (error) {
        logError({
          event: "invoice_document_storage_read_failed",
          invoiceId,
          objectKey: currentAsset.objectKey,
          ...serializeError(error),
        })
      }
    }

    const pdfBuffer = await renderInvoicePdf(toInvoicePdfData(invoiceDto))
    const uploadedObject = await storageProvider.putObject({
      objectKey: buildInvoicePdfObjectKey(invoice.id),
      body: pdfBuffer,
      contentType: "application/pdf",
      contentLength: pdfBuffer.byteLength,
      visibility: "private",
    })

    if (currentAsset) {
      const previousObjectKey = currentAsset.objectKey

      await this.assetsRepository.replace({
        assetId: currentAsset.id,
        asset: {
          kind: "invoice_pdf",
          storageProvider: "r2",
          visibility: uploadedObject.visibility,
          objectKey: uploadedObject.objectKey,
          publicUrl: uploadedObject.publicUrl,
          filename,
          contentType: uploadedObject.contentType,
          sizeBytes: pdfBuffer.byteLength,
        },
      })

      if (previousObjectKey !== uploadedObject.objectKey) {
        try {
          await storageProvider.deleteObject(previousObjectKey)
        } catch (error) {
          logError({
            event: "invoice_document_storage_cleanup_failed",
            invoiceId,
            objectKey: previousObjectKey,
            ...serializeError(error),
          })
        }
      }
    } else {
      const asset = await this.assetsRepository.create({
        kind: "invoice_pdf",
        storageProvider: "r2",
        visibility: uploadedObject.visibility,
        objectKey: uploadedObject.objectKey,
        publicUrl: uploadedObject.publicUrl,
        filename,
        contentType: uploadedObject.contentType,
        sizeBytes: pdfBuffer.byteLength,
      })

      await this.invoicesRepository.setDocumentAssetId(invoice.id, asset.id)
    }

    return {
      body: pdfBuffer,
      contentType: "application/pdf",
      contentLength: pdfBuffer.byteLength,
      filename,
    }
  }
}

function toInvoicePdfData(invoice: ReturnType<typeof toInvoiceDto>): InvoicePdfData {
  return {
    brand_name: "Ink Wave Branding App",
    document_title: "Invoice",
    invoice_number: invoice.invoice_number,
    order_reference: invoice.order_number_snapshot,
    generated_at: formatInvoicePdfDate(invoice.created_at),
    status: toInvoicePdfStatus(invoice.status),
    from: {
      label: "From",
      name: "Ink Wave Branding App",
      lines: [
        "Cup printing operations",
        "Production begins after invoice confirmation.",
      ],
    },
    to: {
      label: "To",
      name: invoice.customer.business_name,
      lines: [
        invoice.customer.contact_person,
        invoice.customer.contact_number,
        invoice.customer.email,
        invoice.customer.address,
      ].filter((line): line is string => Boolean(line)),
    },
    left_meta: [
      { label: "Invoice number", value: invoice.invoice_number },
      { label: "Generated", value: formatInvoicePdfDate(invoice.created_at) },
      { label: "Invoice status", value: toInvoicePdfStatus(invoice.status).label },
    ],
    right_meta: [
      { label: "Order reference", value: invoice.order_number_snapshot },
      { label: "Customer code", value: invoice.customer.customer_code ?? "N/A" },
      { label: "Line items", value: invoice.items.length.toLocaleString() },
    ],
    line_items: invoice.items.map((item) => ({
      item: item.description_snapshot,
      specs: toInvoicePdfSpecs(item.item_type),
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.line_total,
    })),
    subtotal: invoice.subtotal,
    discount: "0.00",
    total: invoice.subtotal,
    paid_amount: invoice.status === "paid" ? invoice.subtotal : "0.00",
    remaining_balance: invoice.status === "pending" ? invoice.subtotal : "0.00",
    payment_instructions: toInvoicePdfPaymentInstructions(invoice.status),
    support_lines: [
      "Ink Wave Branding App",
      "Coordinate through the assigned order contact for invoice follow-up.",
    ],
    footer_note: invoice.status === "void" ? "This invoice has been voided." : "Thank you for your order.",
  }
}

function formatInvoicePdfDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function toInvoicePdfStatus(status: ReturnType<typeof toInvoiceDto>["status"]) {
  switch (status) {
    case "paid":
      return { label: "Paid", tone: "success" as const }
    case "void":
      return { label: "Void", tone: "danger" as const }
    default:
      return { label: "Pending", tone: "warning" as const }
  }
}

function toInvoicePdfSpecs(itemType: ReturnType<typeof toInvoiceDto>["items"][number]["item_type"]) {
  switch (itemType) {
    case "cup":
      return "Cup item"
    case "lid":
      return "Lid item"
    case "non_stock_item":
      return "General item"
    case "custom_charge":
      return "Custom charge"
  }
}

function toInvoicePdfPaymentInstructions(status: ReturnType<typeof toInvoiceDto>["status"]) {
  switch (status) {
    case "paid":
      return ["Payment received. Production or release may proceed per operations workflow."]
    case "void":
      return ["This invoice is void and should not be used for payment collection."]
    default:
      return [
        "Treat this invoice as pending until payment is confirmed by an admin.",
        "Do not begin production from this document alone.",
      ]
  }
}
