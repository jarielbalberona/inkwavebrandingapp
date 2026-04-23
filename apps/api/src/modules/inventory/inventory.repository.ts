import { and, asc, desc, eq, sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  cups,
  inventoryMovements,
  lids,
  type Cup,
  type InventoryMovement,
  type Lid,
  type User,
} from "../../db/schema/index.js"
import type {
  AppendInventoryMovementInput,
  InventoryMovementsQuery,
  ReserveOrderItemsInput,
} from "./inventory.schemas.js"

export type InventoryTrackedItemType = "cup" | "lid"

export interface InventoryCupBalanceSummary {
  itemType: "cup"
  cup: Cup
  lid: null
  onHand: number
  reserved: number
}

export interface InventoryLidBalanceSummary {
  itemType: "lid"
  cup: null
  lid: Lid
  onHand: number
  reserved: number
}

export type InventoryBalanceSummary = InventoryCupBalanceSummary | InventoryLidBalanceSummary

export interface InventoryMovementWithRelations extends InventoryMovement {
  cup: Cup | null
  lid: Lid | null
  createdByUser: User | null
}

export type InventoryItemReference =
  | { itemType: "cup"; cupId: string; lidId?: undefined }
  | { itemType: "lid"; cupId?: undefined; lidId: string }

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

  async getBalanceByItem(reference: InventoryItemReference): Promise<InventoryBalanceSummary | null> {
    if (reference.itemType === "cup") {
      return this.getBalanceByCupId(reference.cupId)
    }

    return this.getBalanceByLidId(reference.lidId)
  }

  async getBalanceByCupId(cupId: string): Promise<InventoryCupBalanceSummary | null> {
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
        and(
          eq(inventoryMovements.itemType, "cup"),
          eq(inventoryMovements.cupId, cups.id),
          eq(cups.id, cupId),
        ),
      )
      .where(eq(cups.id, cupId))
      .groupBy(cups.id)

    const row = rows[0]

    if (!row) {
      return null
    }

    return {
      itemType: "cup",
      cup: row.cup,
      lid: null,
      onHand: Number(row.onHand),
      reserved: Number(row.reserved),
    }
  }

  async getBalanceByLidId(lidId: string): Promise<InventoryLidBalanceSummary | null> {
    const rows = await this.db
      .select({
        lid: lids,
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
      .from(lids)
      .leftJoin(
        inventoryMovements,
        and(
          eq(inventoryMovements.itemType, "lid"),
          eq(inventoryMovements.lidId, lids.id),
          eq(lids.id, lidId),
        ),
      )
      .where(eq(lids.id, lidId))
      .groupBy(lids.id)

    const row = rows[0]

    if (!row) {
      return null
    }

    return {
      itemType: "lid",
      cup: null,
      lid: row.lid,
      onHand: Number(row.onHand),
      reserved: Number(row.reserved),
    }
  }

  async listBalances(options: {
    includeInactive: boolean
    itemType?: InventoryTrackedItemType
  }): Promise<InventoryBalanceSummary[]> {
    const balances: InventoryBalanceSummary[] = []

    if (!options.itemType || options.itemType === "cup") {
      const cupRows = await this.db
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
          and(eq(inventoryMovements.itemType, "cup"), eq(inventoryMovements.cupId, cups.id)),
        )
        .where(options.includeInactive ? undefined : eq(cups.isActive, true))
        .groupBy(cups.id)
        .orderBy(asc(cups.sku))

      balances.push(
        ...cupRows.map((row) => ({
          itemType: "cup" as const,
          cup: row.cup,
          lid: null,
          onHand: Number(row.onHand),
          reserved: Number(row.reserved),
        })),
      )
    }

    if (!options.itemType || options.itemType === "lid") {
      const lidRows = await this.db
        .select({
          lid: lids,
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
        .from(lids)
        .leftJoin(
          inventoryMovements,
          and(eq(inventoryMovements.itemType, "lid"), eq(inventoryMovements.lidId, lids.id)),
        )
        .where(options.includeInactive ? undefined : eq(lids.isActive, true))
        .groupBy(lids.id)
        .orderBy(asc(lids.sku))

      balances.push(
        ...lidRows.map((row) => ({
          itemType: "lid" as const,
          cup: null,
          lid: row.lid,
          onHand: Number(row.onHand),
          reserved: Number(row.reserved),
        })),
      )
    }

    return balances
  }

  async listMovements(filters: InventoryMovementsQuery): Promise<InventoryMovementWithRelations[]> {
    const conditions = [
      filters.item_type ? eq(inventoryMovements.itemType, filters.item_type) : undefined,
      filters.cup_id ? eq(inventoryMovements.cupId, filters.cup_id) : undefined,
      filters.lid_id ? eq(inventoryMovements.lidId, filters.lid_id) : undefined,
      filters.movement_type ? eq(inventoryMovements.movementType, filters.movement_type) : undefined,
    ].filter(Boolean)

    const rows = await this.db.query.inventoryMovements.findMany({
      where: conditions.length === 0 ? undefined : and(...conditions),
      with: {
        cup: true,
        lid: true,
        createdByUser: true,
      },
      orderBy: [desc(inventoryMovements.createdAt)],
      limit: 200,
    })

    return rows.map((row) => ({
      ...row,
      createdByUser: row.createdByUser ?? null,
      cup: row.cup ?? null,
      lid: row.lid ?? null,
    }))
  }

  toBalanceReference(item: ReserveOrderItemsInput["items"][number]): InventoryItemReference {
    if (item.itemType === "cup") {
      return {
        itemType: "cup",
        cupId: item.cupId!,
      }
    }

    return {
      itemType: "lid",
      lidId: item.lidId!,
    }
  }
}
