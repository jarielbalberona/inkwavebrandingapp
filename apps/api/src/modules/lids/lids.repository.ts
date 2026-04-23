import { asc, eq } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { hasLidHistoricalUsage } from "../../lib/master-data/item-history.js"
import { lids, type Lid } from "../../db/schema/index.js"
import type { CreateLidInput, UpdateLidInput } from "./lids.schemas.js"

export interface PersistedCreateLidInput extends CreateLidInput {
  sku: string
}

export interface PersistedUpdateLidInput extends UpdateLidInput {
  sku?: string
}

export class LidsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async list(options: { includeInactive?: boolean } = {}): Promise<Lid[]> {
    return this.db
      .select()
      .from(lids)
      .where(options.includeInactive ? undefined : eq(lids.isActive, true))
      .orderBy(asc(lids.sku))
  }

  async findById(id: string): Promise<Lid | undefined> {
    const rows = await this.db.select().from(lids).where(eq(lids.id, id)).limit(1)
    return rows[0]
  }

  async hasHistoricalUsage(id: string): Promise<boolean> {
    return hasLidHistoricalUsage(this.db, id)
  }

  async create(input: PersistedCreateLidInput): Promise<Lid> {
    const rows = await this.db.insert(lids).values(input).returning()
    const lid = rows[0]

    if (!lid) {
      throw new Error("Failed to create lid")
    }

    return lid
  }

  async update(id: string, input: PersistedUpdateLidInput): Promise<Lid | undefined> {
    const rows = await this.db
      .update(lids)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(lids.id, id))
      .returning()

    return rows[0]
  }
}
