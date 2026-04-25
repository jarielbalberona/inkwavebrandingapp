import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  orderItems,
  orderLineItemProgressEvents,
  orders,
  type NewOrderLineItemProgressEvent,
  type NewOrder,
  type NewOrderItem,
  type Order,
} from "../../db/schema/index.js"

export type OrderWithRelations = NonNullable<Awaited<ReturnType<OrdersRepository["findByIdWithRelations"]>>>
export type OrderItemWithOrder = NonNullable<Awaited<ReturnType<OrdersRepository["findOrderItemWithOrder"]>>>
export type ProgressEventWithRelations = Awaited<
  ReturnType<OrdersRepository["listProgressEventsForOrderItem"]>
>[number]
export type OrderItemWithProgressEvents = Awaited<
  ReturnType<OrdersRepository["listOrderItemsWithProgressEvents"]>
>[number]

export class OrdersRepository {
  constructor(private readonly db: DatabaseClient) {}

  async transaction<T>(
    handler: (context: { db: DatabaseClient; ordersRepository: OrdersRepository }) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) =>
      handler({
        db: tx as DatabaseClient,
        ordersRepository: new OrdersRepository(tx as DatabaseClient),
      }),
    )
  }

  async createOrderWithItems(input: {
    order: NewOrder
    items: Omit<NewOrderItem, "orderId">[]
  }): Promise<OrderWithRelations> {
    const orderRows = await this.db.insert(orders).values(input.order).returning()
    const order = orderRows[0]

    if (!order) {
      throw new Error("Failed to create order")
    }

    if (input.items.length > 0) {
      await this.db
        .insert(orderItems)
        .values(input.items.map((item) => ({ ...item, orderId: order.id })))
    }

    const orderWithRelations = await this.findByIdWithRelations(order.id)

    if (!orderWithRelations) {
      throw new Error("Failed to load created order")
    }

    return orderWithRelations
  }

  async createOrderItems(
    orderId: string,
    items: Omit<NewOrderItem, "orderId">[],
  ): Promise<void> {
    if (items.length === 0) {
      return
    }

    await this.db.insert(orderItems).values(items.map((item) => ({ ...item, orderId })))
  }

  async findByIdWithRelations(id: string) {
    return this.db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        customer: true,
        items: {
          with: {
            cup: true,
            lid: true,
            nonStockItem: true,
            productBundle: true,
          },
        },
      },
    })
  }

  async listWithRelations(options: { status?: Order["status"]; includeArchived?: boolean } = {}) {
    return this.db.query.orders.findMany({
      where: and(
        options.status ? eq(orders.status, options.status) : undefined,
        options.includeArchived ? undefined : isNull(orders.archivedAt),
      ),
      with: {
        customer: true,
        items: {
          with: {
            cup: true,
            lid: true,
            nonStockItem: true,
            productBundle: true,
          },
        },
      },
      orderBy: [asc(orders.priority), desc(orders.createdAt)],
      limit: 200,
    })
  }

  async hasAnyOrders(): Promise<boolean> {
    const rows = await this.db.select({ id: orders.id }).from(orders).limit(1)

    return rows.length > 0
  }

  async getMinimumPriority(): Promise<number | null> {
    const result = await this.db
      .select({ value: sql<number | null>`min(${orders.priority})` })
      .from(orders)

    return result[0]?.value ?? null
  }

  async findOrderItemWithOrder(id: string) {
    return this.db.query.orderItems.findFirst({
      where: eq(orderItems.id, id),
      with: {
        order: true,
        cup: true,
        lid: true,
        nonStockItem: true,
        productBundle: true,
      },
    })
  }

  async listOrderItemsWithProgressEvents(orderId: string) {
    return this.db.query.orderItems.findMany({
      where: eq(orderItems.orderId, orderId),
      with: {
        progressEvents: true,
        productBundle: true,
      },
    })
  }

  async updateOrderStatus(orderId: string, status: Order["status"]): Promise<void> {
    await this.db
      .update(orders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
  }

  async archiveOrder(orderId: string): Promise<void> {
    await this.db
      .update(orders)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
  }

  async updateOrderMetadata(
    orderId: string,
    input: { customerId?: string; notes?: string | null },
  ): Promise<void> {
    await this.db
      .update(orders)
      .set({
        customerId: input.customerId,
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
  }

  async updateOrderItem(
    orderItemId: string,
    input: Omit<NewOrderItem, "orderId">,
  ): Promise<void> {
    await this.db
      .update(orderItems)
      .set({
        itemType: input.itemType,
        cupId: input.cupId,
        lidId: input.lidId,
        nonStockItemId: input.nonStockItemId,
        productBundleId: input.productBundleId,
        descriptionSnapshot: input.descriptionSnapshot,
        quantity: input.quantity,
        unitCostPrice: input.unitCostPrice,
        unitSellPrice: input.unitSellPrice,
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(orderItems.id, orderItemId))
  }

  async deleteOrderItems(orderItemIds: string[]): Promise<void> {
    if (orderItemIds.length === 0) {
      return
    }

    await this.db.delete(orderItems).where(inArray(orderItems.id, orderItemIds))
  }

  async listAllOrderIdsByPriority(): Promise<string[]> {
    const rows = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(isNull(orders.archivedAt))
      .orderBy(asc(orders.priority), desc(orders.createdAt))

    return rows.map((row) => row.id)
  }

  async countOrdersByIds(orderIds: string[]): Promise<number> {
    if (orderIds.length === 0) {
      return 0
    }

    const rows = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(inArray(orders.id, orderIds), isNull(orders.archivedAt)))

    return rows.length
  }

  async replacePrioritiesByOrderIds(orderIds: string[]): Promise<void> {
    for (const [index, orderId] of orderIds.entries()) {
      await this.db
        .update(orders)
        .set({
          priority: index,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.db
      .update(orders)
      .set({
        status: "canceled",
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
  }

  async listProgressEventsForOrderItem(orderLineItemId: string) {
    return this.db.query.orderLineItemProgressEvents.findMany({
      where: eq(orderLineItemProgressEvents.orderLineItemId, orderLineItemId),
      with: {
        createdByUser: true,
      },
      orderBy: [
        asc(orderLineItemProgressEvents.eventDate),
        asc(orderLineItemProgressEvents.createdAt),
      ],
    })
  }

  async createProgressEvent(
    input: NewOrderLineItemProgressEvent,
  ): Promise<ProgressEventWithRelations> {
    const rows = await this.db.insert(orderLineItemProgressEvents).values(input).returning()
    const event = rows[0]

    if (!event) {
      throw new Error("Failed to create progress event")
    }

    const events = await this.db.query.orderLineItemProgressEvents.findMany({
      where: eq(orderLineItemProgressEvents.id, event.id),
      with: {
        createdByUser: true,
      },
      limit: 1,
    })
    const eventWithRelations = events[0]

    if (!eventWithRelations) {
      throw new Error("Failed to load created progress event")
    }

    return eventWithRelations
  }
}
