import { sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { inventoryMovements, invoiceItems, orderItems } from "../../db/schema/index.js"

export async function hasCupHistoricalUsage(db: DatabaseClient, cupId: string): Promise<boolean> {
  const result = await db.execute<{ hasUsage: boolean }>(sql`
    select (
      exists(select 1 from ${inventoryMovements} where ${inventoryMovements.cupId} = ${cupId})
      or exists(select 1 from ${orderItems} where ${orderItems.cupId} = ${cupId})
      or exists(
        select 1
        from ${invoiceItems}
        inner join ${orderItems} on ${invoiceItems.orderItemId} = ${orderItems.id}
        where ${orderItems.cupId} = ${cupId}
      )
    ) as "hasUsage"
  `)

  return Boolean(result.rows[0]?.hasUsage)
}

export async function hasLidHistoricalUsage(db: DatabaseClient, lidId: string): Promise<boolean> {
  const result = await db.execute<{ hasUsage: boolean }>(sql`
    select (
      exists(select 1 from ${inventoryMovements} where ${inventoryMovements.lidId} = ${lidId})
      or exists(select 1 from ${orderItems} where ${orderItems.lidId} = ${lidId})
      or exists(
        select 1
        from ${invoiceItems}
        inner join ${orderItems} on ${invoiceItems.orderItemId} = ${orderItems.id}
        where ${orderItems.lidId} = ${lidId}
      )
    ) as "hasUsage"
  `)

  return Boolean(result.rows[0]?.hasUsage)
}
