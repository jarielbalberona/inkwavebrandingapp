import { and, asc, eq, sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { hasCupHistoricalUsage } from "../../lib/master-data/item-history.js"
import { cups, type Cup } from "../../db/schema/index.js"
import type { CreateCupInput, UpdateCupInput } from "./cups.schemas.js"
import { normalizeSku } from "./sku.js"

export class CupsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async list(options: { includeInactive?: boolean } = {}): Promise<Cup[]> {
    if (options.includeInactive) {
      return this.db.select().from(cups).orderBy(asc(cups.sku))
    }

    return this.db.select().from(cups).where(eq(cups.isActive, true)).orderBy(asc(cups.sku))
  }

  async listBySkuSearch(search: string, options: { includeInactive?: boolean } = {}): Promise<Cup[]> {
    const normalizedSearch = `%${normalizeSku(search)}%`

    if (options.includeInactive) {
      return this.db
        .select()
        .from(cups)
        .where(sql`${cups.sku} ILIKE ${normalizedSearch}`)
        .orderBy(asc(cups.sku))
    }

    return this.db
      .select()
      .from(cups)
      .where(and(eq(cups.isActive, true), sql`${cups.sku} ILIKE ${normalizedSearch}`))
      .orderBy(asc(cups.sku))
  }

  async findById(id: string): Promise<Cup | undefined> {
    const rows = await this.db.select().from(cups).where(eq(cups.id, id)).limit(1)

    return rows[0]
  }

  async findBySku(sku: string): Promise<Cup | undefined> {
    const rows = await this.db.select().from(cups).where(eq(cups.sku, normalizeSku(sku))).limit(1)

    return rows[0]
  }

  async hasHistoricalUsage(id: string): Promise<boolean> {
    return hasCupHistoricalUsage(this.db, id)
  }

  async create(input: CreateCupInput): Promise<Cup> {
    const rows = await this.db.insert(cups).values(input).returning()

    return requireCup(rows[0], "Failed to create cup")
  }

  async update(id: string, input: UpdateCupInput): Promise<Cup | undefined> {
    const rows = await this.db
      .update(cups)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(cups.id, id))
      .returning()

    return rows[0]
  }
}

function requireCup(cup: Cup | undefined, message: string): Cup {
  if (!cup) {
    throw new Error(message)
  }

  return cup
}
