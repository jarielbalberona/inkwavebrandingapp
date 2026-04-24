import { randomBytes } from "node:crypto"

interface BuildObjectKeyInput {
  domain: string
  entityId?: string
  category: string
  extension: string
}

export function buildObjectKey(input: BuildObjectKeyInput) {
  const extension = normalizeExtension(input.extension)
  const timestamp = Date.now()
  const randomSuffix = randomBytes(8).toString("hex")
  const segments = [
    sanitizePathSegment(input.domain),
    input.entityId ? sanitizePathSegment(input.entityId) : undefined,
    sanitizePathSegment(input.category),
    `${timestamp}-${randomSuffix}.${extension}`,
  ].filter(Boolean)

  return segments.join("/")
}

export function buildInvoicePdfObjectKey(invoiceId: string) {
  return buildObjectKey({
    domain: "invoices",
    entityId: invoiceId,
    category: "pdf",
    extension: "pdf",
  })
}

function normalizeExtension(extension: string) {
  const normalized = extension.trim().replace(/^\.+/, "").toLowerCase()

  if (!normalized) {
    throw new Error("Object key extension is required")
  }

  if (!/^[a-z0-9]+$/.test(normalized)) {
    throw new Error(`Invalid object key extension: ${extension}`)
  }

  return normalized
}

function sanitizePathSegment(segment: string) {
  const normalized = segment.trim().toLowerCase()

  if (!normalized) {
    throw new Error("Object key path segment cannot be blank")
  }

  const sanitized = normalized.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")

  if (!sanitized) {
    throw new Error(`Invalid object key path segment: ${segment}`)
  }

  return sanitized
}
