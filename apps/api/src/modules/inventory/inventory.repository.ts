import { and, asc, desc, eq, sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  cups,
  inventoryMovements,
  type Cup,
  type InventoryMovement,
  type User,
} from "../../db/schema/index.js"
import type {
  AppendInventoryMovementInput,
  InventoryMovementsQuery,
} from "./inventory.schemas.js"

export interface InventoryBalanceSummary {
  cup: Cup
  onHand: number
  reserved: number
}

export interface InventoryMovementWithRelations extends InventoryMovement {
  cup: Cup
  createdByUser: User | null
}

export class InventoryRepository {
  constructor(private readonly db: DatabaseClient) {}

  async transaction<T>(handler: (repository: InventoryRepository) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => handler(new InventoryRepository(tx as DatabaseClient)))
  }

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

  async listBalances(options: { includeInactive: boolean }): Promise<InventoryBalanceSummary[]> {
    const rows = await this.db
      .select({
        cup: cups,
        onHand: sql<number>`COALESCE(SUM(
          CASE
            WHEN ${inventoryMovements.movementType} IN ('stock_in', 'adjustment_in') THEN ${inventoryMovements.quantity}
            WHEN ${inventoryMovements.movementType} IN ('consume', 'adjustment_out') THEN -${inventoryMovements.quantity}
            ELSE 0
          END
        ), 0)`,
        reserved: sql<number>`COALESCE(SUM(
          CASE
            WHEN ${inventoryMovements.movementType} = 'reserve' THEN ${inventoryMovements.quantity}
            WHEN ${inventoryMovements.movementType} IN ('release_reservation', 'consume') THEN -${inventoryMovements.quantity}
            ELSE 0
          END
        ), 0)`,
      })
      .from(cups)
      .leftJoin(inventoryMovements, eq(inventoryMovements.cupId, cups.id))
      .where(options.includeInactive ? undefined : eq(cups.isActive, true))
      .groupBy(cups.id)
      .orderBy(asc(cups.sku))

    return rows.map((row) => ({
      cup: row.cup,
      onHand: Number(row.onHand),
      reserved: Number(row.reserved),
    }))
  }

  async getBalanceByCupId(cupId: string): Promise<InventoryBalanceSummary | null> {
    const rows = await this.db
      .select({
        cup: cups,
        onHand: sql<number>`COALESCE(SUM(
          CASE
            WHEN ${inventoryMovements.movementType} IN ('stock_in', 'adjustment_in') THEN ${inventoryMovements.quantity}
            WHEN ${inventoryMovements.movementType} IN ('consume', 'adjustment_out') THEN -${inventoryMovements.quantity}
            ELSE 0
          END
        ), 0)`,
        reserved: sql<number>`COALESCE(SUM(
          CASE
            WHEN ${inventoryMovements.movementType} = 'reserve' THEN ${inventoryMovements.quantity}
            WHEN ${inventoryMovements.movementType} IN ('release_reservation', 'consume') THEN -${inventoryMovements.quantity}
            ELSE 0
          END
        ), 0)`,
      })
      .from(cups)
      .leftJoin(
        inventoryMovements,
        and(eq(inventoryMovements.cupId, cups.id), eq(cups.id, cupId)),
      )
      .where(eq(cups.id, cupId))
      .groupBy(cups.id)

    const row = rows[0]

    if (!row) {
      return null
    }

    return {
      cup: row.cup,
      onHand: Number(row.onHand),
      reserved: Number(row.reserved),
    }
  }

  async listMovements(filters: InventoryMovementsQuery): Promise<InventoryMovementWithRelations[]> {
    const conditions = [
      filters.cup_id ? eq(inventoryMovements.cupId, filters.cup_id) : undefined,
      filters.movement_type ? eq(inventoryMovements.movementType, filters.movement_type) : undefined,
    ].filter(Boolean)

    const rows = await this.db.query.inventoryMovements.findMany({
      where: conditions.length === 0 ? undefined : and(...conditions),
      with: {
        cup: true,
        createdByUser: true,
      },
      orderBy: [desc(inventoryMovements.createdAt)],
      limit: 200,
    })

    return rows.map((row) => ({
      ...row,
      createdByUser: row.createdByUser ?? null,
    }))
  }
}
