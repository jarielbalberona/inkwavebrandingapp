import { randomUUID } from "node:crypto"

import type { DatabaseClient } from "../../db/client.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { CupsRepository } from "../cups/cups.repository.js"
import { CustomersRepository } from "../customers/customers.repository.js"
import { InventoryService } from "../inventory/inventory.service.js"
import { createOrderSchema, type CreateOrderInput } from "./orders.schemas.js"
import { OrdersRepository } from "./orders.repository.js"
import { toOrderDto, type OrderDto } from "./orders.types.js"

export class OrderCustomerNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Customer not found")
  }
}

export class OrderCustomerInactiveError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Cannot create an order for an inactive customer")
  }
}

export class OrderCupNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Cup not found")
  }
}

export class OrderCupInactiveError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Cannot create an order for an inactive cup")
  }
}

export class DuplicateOrderCupError extends Error {
  readonly statusCode = 400

  constructor() {
    super("Duplicate cup in order line items")
  }
}

export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly cupsRepository: CupsRepository,
    private readonly createInventoryService: (db: DatabaseClient) => InventoryService,
  ) {}

  async create(input: CreateOrderInput, user: SafeUser): Promise<OrderDto> {
    const parsedInput = createOrderSchema.parse(input)
    const customer = await this.customersRepository.findById(parsedInput.customer_id)

    if (!customer) {
      throw new OrderCustomerNotFoundError()
    }

    if (!customer.isActive) {
      throw new OrderCustomerInactiveError()
    }

    const cupIds = new Set<string>()

    for (const item of parsedInput.line_items) {
      if (cupIds.has(item.cup_id)) {
        throw new DuplicateOrderCupError()
      }

      cupIds.add(item.cup_id)
    }

    const cups = await Promise.all(
      parsedInput.line_items.map(async (item) => {
        const cup = await this.cupsRepository.findById(item.cup_id)

        if (!cup) {
          throw new OrderCupNotFoundError()
        }

        if (!cup.isActive) {
          throw new OrderCupInactiveError()
        }

        return cup
      }),
    )

    return this.ordersRepository.transaction(async ({ db, ordersRepository }) => {
      const order = await ordersRepository.createOrderWithItems({
        order: {
          orderNumber: createOrderNumber(),
          customerId: parsedInput.customer_id,
          status: "pending",
          notes: parsedInput.notes,
          createdByUserId: user.id,
        },
        items: parsedInput.line_items.map((item, index) => {
          const cup = cups[index]

          if (!cup) {
            throw new OrderCupNotFoundError()
          }

          return {
            cupId: item.cup_id,
            quantity: item.quantity,
            costPrice: cup.costPrice,
            sellPrice: cup.defaultSellPrice,
            notes: item.notes,
          }
        }),
      })

      await this.createInventoryService(db).reserveOrderItems(
        {
          orderId: order.id,
          createdByUserId: user.id,
          items: order.items.map((item) => ({
            orderItemId: item.id,
            cupId: item.cupId,
            quantity: item.quantity,
          })),
        },
        { useExistingTransaction: true },
      )

      return toOrderDto(order, user)
    })
  }
}

function createOrderNumber(): string {
  const datePrefix = new Date().toISOString().slice(0, 10).replaceAll("-", "")

  return `IW-${datePrefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}
