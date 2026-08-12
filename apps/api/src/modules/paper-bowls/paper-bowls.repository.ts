import { asc, eq } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { paperBowls, type PaperBowl } from "../../db/schema/index.js"
import type { CreatePaperBowlInput, UpdatePaperBowlInput } from "./paper-bowls.schemas.js"

export class PaperBowlsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async list(includeInactive = false): Promise<PaperBowl[]> {
    return includeInactive
      ? this.db.select().from(paperBowls).orderBy(asc(paperBowls.size), asc(paperBowls.color))
      : this.db
          .select()
          .from(paperBowls)
          .where(eq(paperBowls.isActive, true))
          .orderBy(asc(paperBowls.size), asc(paperBowls.color))
  }

  async findById(id: string): Promise<PaperBowl | undefined> {
    return (await this.db.select().from(paperBowls).where(eq(paperBowls.id, id)).limit(1))[0]
  }

  async create(input: CreatePaperBowlInput & { sku: string }): Promise<PaperBowl> {
    const row = (await this.db.insert(paperBowls).values({ ...input, supplier: "other_supplier" }).returning())[0]
    if (!row) throw new Error("Failed to create paper bowl")
    return row
  }

  async update(
    id: string,
    input: UpdatePaperBowlInput & { sku?: string },
  ): Promise<PaperBowl | undefined> {
    return (
      await this.db
        .update(paperBowls)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(paperBowls.id, id))
        .returning()
    )[0]
  }
}
