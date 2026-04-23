import { asc, eq } from "drizzle-orm"

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

  async findByIdWithRelations(id: string) {
    return this.db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        customer: true,
        items: {
          with: {
            cup: true,
          },
        },
      },
    })
  }

  async findOrderItemWithOrder(id: string) {
    return this.db.query.orderItems.findFirst({
      where: eq(orderItems.id, id),
      with: {
        order: true,
      },
    })
  }

  async listOrderItemsWithProgressEvents(orderId: string) {
    return this.db.query.orderItems.findMany({
      where: eq(orderItems.orderId, orderId),
      with: {
        progressEvents: true,
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
