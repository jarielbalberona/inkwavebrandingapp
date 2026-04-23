import { eq } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import {
  orderItems,
  orders,
  type NewOrder,
  type NewOrderItem,
} from "../../db/schema/index.js"

export type OrderWithRelations = NonNullable<Awaited<ReturnType<OrdersRepository["findByIdWithRelations"]>>>

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
}
