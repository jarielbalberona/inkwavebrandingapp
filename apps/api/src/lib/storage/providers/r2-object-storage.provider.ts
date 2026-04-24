import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import type { R2StorageConfig } from "../../../config/storage.js"
import type { ObjectStorageProvider, PutObjectInput } from "../object-storage.types.js"

export class R2ObjectStorageProvider implements ObjectStorageProvider {
  private client: S3Client | null = null

  constructor(private readonly config: R2StorageConfig) {}

  async putObject(input: PutObjectInput) {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        CacheControl: input.cacheControl,
      }),
    )

    const visibility = input.visibility ?? "private"

    return {
      objectKey: input.objectKey,
      contentType: input.contentType,
      contentLength: input.contentLength ?? null,
      visibility,
      publicUrl: this.getPublicUrl(input.objectKey, visibility),
    }
  }

  async deleteObject(objectKey: string) {
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: objectKey,
      }),
    )
  }

  async getObject(objectKey: string) {
    const response = await this.getClient().send(
      new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: objectKey,
      }),
    )

    const bytes = await response.Body?.transformToByteArray()

    if (!bytes) {
      throw new Error(`Stored object ${objectKey} has no body`)
    }

    return {
      body: Buffer.from(bytes),
      contentType: response.ContentType ?? null,
      contentLength: response.ContentLength ?? null,
    }
  }

  getPublicUrl(objectKey: string, visibility: "public" | "private" = "private") {
    if (!this.config.usePublicCdn || visibility !== "public" || !this.config.publicUrl) {
      return null
    }

    return `${this.config.publicUrl.replace(/\/+$/, "")}/${objectKey}`
  }

  private getClient() {
    if (!this.client) {
      this.client = new S3Client({
        region: "auto",
        endpoint: this.config.endpoint,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      })
    }

    return this.client
  }
}
