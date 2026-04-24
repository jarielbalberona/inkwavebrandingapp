import { renderInvoicePdf } from "@workspace/pdfs/server"

import { loadStorageConfig, type StorageConfig } from "../../config/storage.js"
import { createObjectStorageProvider } from "../../lib/storage/object-storage.provider.js"
import { buildInvoicePdfObjectKey } from "../../lib/storage/object-keys.js"
import { logError, serializeError } from "../../lib/logger.js"
import type { ObjectStorageProvider } from "../../lib/storage/object-storage.types.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { assertAdmin } from "../auth/authorization.js"
import { AssetsRepository } from "../assets/assets.repository.js"
import { InvoiceNotFoundError } from "./invoices.service.js"
import { toInvoicePdfData } from "./invoice-pdf.mapper.js"
import { InvoicesRepository } from "./invoices.repository.js"
import { toInvoiceDto } from "./invoices.types.js"

export class InvoiceShareLinkUnavailableError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Shareable invoice links require R2 public CDN storage.")
  }
}

export class InvoiceDocumentsService {
  constructor(
    private readonly invoicesRepository: InvoicesRepository,
    private readonly assetsRepository: AssetsRepository,
    private readonly storageConfig: StorageConfig,
    private readonly storageProvider: ObjectStorageProvider | null = createObjectStorageProvider(storageConfig),
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
    const desiredVisibility = this.getDesiredVisibility()

    if (!this.storageProvider) {
      const pdfBuffer = await renderInvoicePdf(toInvoicePdfData(invoiceDto))

      return {
        body: pdfBuffer,
        contentType: "application/pdf",
        contentLength: pdfBuffer.byteLength,
        filename,
      }
    }

    const currentAsset = invoice.documentAsset ?? null

    if (
      currentAsset &&
      currentAsset.updatedAt >= invoice.updatedAt &&
      currentAsset.visibility === desiredVisibility &&
      (desiredVisibility !== "public" || Boolean(currentAsset.publicUrl))
    ) {
      try {
        const storedObject = await this.storageProvider.getObject(currentAsset.objectKey)

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
    const uploadedObject = await this.storageProvider.putObject({
      objectKey: buildInvoicePdfObjectKey(invoice.id),
      body: pdfBuffer,
      contentType: "application/pdf",
      contentLength: pdfBuffer.byteLength,
      visibility: desiredVisibility,
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
          await this.storageProvider.deleteObject(previousObjectKey)
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

  async getShareablePdfLink(invoiceId: string, user: SafeUser) {
    assertAdmin(user)

    if (!this.storageProvider || !this.storageConfig.r2?.usePublicCdn) {
      throw new InvoiceShareLinkUnavailableError()
    }

    await this.getPdfDocument(invoiceId, user)

    const invoice = await this.invoicesRepository.findByIdWithRelations(invoiceId)

    if (!invoice) {
      throw new InvoiceNotFoundError()
    }

    const publicUrl = invoice.documentAsset?.publicUrl ?? null

    if (!publicUrl) {
      throw new InvoiceShareLinkUnavailableError()
    }

    return {
      url: publicUrl,
      filename: invoice.documentAsset?.filename ?? `${invoice.invoiceNumber}.pdf`,
    }
  }

  private getDesiredVisibility() {
    return this.storageConfig.r2?.usePublicCdn ? "public" : "private"
  }
}
