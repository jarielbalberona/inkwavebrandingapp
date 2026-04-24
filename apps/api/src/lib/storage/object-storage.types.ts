import type { Readable } from "node:stream"

export type StoredObjectVisibility = "public" | "private"

export interface PutObjectInput {
  objectKey: string
  body: Buffer | Uint8Array | Readable
  contentType: string
  contentLength?: number
  cacheControl?: string
  visibility?: StoredObjectVisibility
}

export interface StoredObject {
  objectKey: string
  contentType: string
  contentLength: number | null
  visibility: StoredObjectVisibility
  publicUrl: string | null
}

export interface RetrievedObject {
  body: Buffer
  contentType: string | null
  contentLength: number | null
}

export interface ObjectStorageProvider {
  putObject(input: PutObjectInput): Promise<StoredObject>
  getObject(objectKey: string): Promise<RetrievedObject>
  deleteObject(objectKey: string): Promise<void>
  getPublicUrl(objectKey: string, visibility?: StoredObjectVisibility): string | null
}
