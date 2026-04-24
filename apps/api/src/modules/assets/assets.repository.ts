import { eq } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { assets, type Asset, type NewAsset } from "../../db/schema/index.js"

export class AssetsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: NewAsset): Promise<Asset> {
    const rows = await this.db.insert(assets).values(input).returning()
    const asset = rows[0]

    if (!asset) {
      throw new Error("Failed to create asset")
    }

    return asset
  }

  async findById(id: string): Promise<Asset | null> {
    return (
      (await this.db.query.assets.findFirst({
        where: eq(assets.id, id),
      })) ?? null
    )
  }

  async findByObjectKey(objectKey: string): Promise<Asset | null> {
    return (
      (await this.db.query.assets.findFirst({
        where: eq(assets.objectKey, objectKey),
      })) ?? null
    )
  }

  async replace(input: {
    assetId: string
    asset: Pick<
      NewAsset,
      | "objectKey"
      | "publicUrl"
      | "filename"
      | "contentType"
      | "sizeBytes"
      | "visibility"
      | "storageProvider"
      | "kind"
    >
  }): Promise<Asset> {
    await this.db
      .update(assets)
      .set({
        ...input.asset,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, input.assetId))

    const asset = await this.findById(input.assetId)

    if (!asset) {
      throw new Error("Failed to load replaced asset")
    }

    return asset
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(assets).where(eq(assets.id, id))
  }
}
