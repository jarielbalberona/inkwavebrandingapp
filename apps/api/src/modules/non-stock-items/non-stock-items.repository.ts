import { and, asc, eq, ilike } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { nonStockItems, type NonStockItem } from "../../db/schema/index.js"
import type {
  CreateNonStockItemInput,
  UpdateNonStockItemInput,
} from "./non-stock-items.schemas.js"

export class NonStockItemsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async list(options: { includeInactive?: boolean; name?: string } = {}): Promise<NonStockItem[]> {
    const where = and(
      options.includeInactive ? undefined : eq(nonStockItems.isActive, true),
      options.name ? ilike(nonStockItems.name, `%${options.name}%`) : undefined,
    )

    return this.db.select().from(nonStockItems).where(where).orderBy(asc(nonStockItems.name))
  }

  async findById(id: string): Promise<NonStockItem | undefined> {
    const rows = await this.db.select().from(nonStockItems).where(eq(nonStockItems.id, id)).limit(1)
    return rows[0]
  }

  async create(input: CreateNonStockItemInput): Promise<NonStockItem> {
    const rows = await this.db.insert(nonStockItems).values(input).returning()
    return requireNonStockItem(rows[0], "Failed to create non-stock item")
  }

  async update(id: string, input: UpdateNonStockItemInput): Promise<NonStockItem | undefined> {
    const rows = await this.db
      .update(nonStockItems)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(nonStockItems.id, id))
      .returning()

    return rows[0]
  }
}

function requireNonStockItem(
  nonStockItem: NonStockItem | undefined,
  message: string,
): NonStockItem {
  if (!nonStockItem) {
    throw new Error(message)
  }

  return nonStockItem
}
