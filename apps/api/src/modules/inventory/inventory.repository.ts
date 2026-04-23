import { desc, eq } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  inventoryMovements,
  type InventoryMovement,
} from "../../db/schema/index.js"
import type { AppendInventoryMovementInput } from "./inventory.schemas.js"

export class InventoryRepository {
  constructor(private readonly db: DatabaseClient) {}

  async appendMovement(input: AppendInventoryMovementInput): Promise<InventoryMovement> {
    const rows = await this.db.insert(inventoryMovements).values(input).returning()
    const movement = rows[0]

    if (!movement) {
      throw new Error("Failed to append inventory movement")
    }

    return movement
  }

  async listForCup(cupId: string): Promise<InventoryMovement[]> {
    return this.db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.cupId, cupId))
      .orderBy(desc(inventoryMovements.createdAt))
  }
}
