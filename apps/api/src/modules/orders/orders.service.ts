import { randomUUID } from "node:crypto"

import type { DatabaseClient } from "../../db/client.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { CupsRepository } from "../cups/cups.repository.js"
import { CustomersRepository } from "../customers/customers.repository.js"
import { InventoryService } from "../inventory/inventory.service.js"
import {
  createOrderLineItemProgressEventSchema,
  createOrderSchema,
  type CreateOrderInput,
  type CreateOrderLineItemProgressEventInput,
  type OrderLineItemProgressStage,
} from "./orders.schemas.js"
import { OrdersRepository } from "./orders.repository.js"
import {
  toOrderDto,
  toProgressEventDto,
  type OrderDto,
  type ProgressTotalsDto,
} from "./orders.types.js"

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

export class OrderLineItemNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Order line item not found")
  }
}

export class OrderProgressClosedError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Cannot add progress events to a canceled order")
  }
}

export class OrderProgressValidationError extends Error {
  readonly statusCode = 409

  constructor(message: string) {
    super(message)
  }
}

const progressStages = [
  "printed",
  "qa_passed",
  "packed",
  "ready_for_release",
  "released",
] as const satisfies readonly OrderLineItemProgressStage[]

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

  async listProgressEvents(orderLineItemId: string) {
    const orderItem = await this.ordersRepository.findOrderItemWithOrder(orderLineItemId)

    if (!orderItem) {
      throw new OrderLineItemNotFoundError()
    }

    const events = await this.ordersRepository.listProgressEventsForOrderItem(orderLineItemId)

    return {
      events: events.map(toProgressEventDto),
      totals: calculateProgressTotals(orderItem.quantity, events),
    }
  }

  async createProgressEvent(
    orderLineItemId: string,
    input: CreateOrderLineItemProgressEventInput,
    user: SafeUser,
  ) {
    const parsedInput = createOrderLineItemProgressEventSchema.parse(input)
    const orderItem = await this.ordersRepository.findOrderItemWithOrder(orderLineItemId)

    if (!orderItem) {
      throw new OrderLineItemNotFoundError()
    }

    if (orderItem.order.status === "canceled") {
      throw new OrderProgressClosedError()
    }

    const existingEvents = await this.ordersRepository.listProgressEventsForOrderItem(orderLineItemId)
    const nextTotals = calculateProgressTotals(orderItem.quantity, [
      ...existingEvents,
      {
        stage: parsedInput.stage,
        quantity: parsedInput.quantity,
      },
    ])

    validateProgressTotals(orderItem.quantity, nextTotals)

    const event = await this.ordersRepository.createProgressEvent({
      orderLineItemId,
      stage: parsedInput.stage,
      quantity: parsedInput.quantity,
      note: parsedInput.note,
      eventDate: parsedInput.event_date,
      createdByUserId: user.id,
    })
    const events = [...existingEvents, event]

    return {
      event: toProgressEventDto(event),
      totals: calculateProgressTotals(orderItem.quantity, events),
    }
  }
}

function createOrderNumber(): string {
  const datePrefix = new Date().toISOString().slice(0, 10).replaceAll("-", "")

  return `IW-${datePrefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function calculateProgressTotals(
  orderedQuantity: number,
  events: Array<{ stage: OrderLineItemProgressStage; quantity: number }>,
): ProgressTotalsDto {
  const totals = {
    total_printed: 0,
    total_qa_passed: 0,
    total_packed: 0,
    total_ready_for_release: 0,
    total_released: 0,
    remaining_balance: orderedQuantity,
  }

  for (const event of events) {
    switch (event.stage) {
      case "printed":
        totals.total_printed += event.quantity
        break
      case "qa_passed":
        totals.total_qa_passed += event.quantity
        break
      case "packed":
        totals.total_packed += event.quantity
        break
      case "ready_for_release":
        totals.total_ready_for_release += event.quantity
        break
      case "released":
        totals.total_released += event.quantity
        break
    }
  }

  totals.remaining_balance = orderedQuantity - totals.total_released

  return totals
}

function validateProgressTotals(orderedQuantity: number, totals: ProgressTotalsDto) {
  for (const stage of progressStages) {
    const total = totalForStage(totals, stage)

    if (total > orderedQuantity) {
      throw new OrderProgressValidationError(`${stage} total cannot exceed ordered quantity`)
    }
  }

  if (totals.total_qa_passed > totals.total_printed) {
    throw new OrderProgressValidationError("QA passed quantity cannot exceed printed quantity")
  }

  if (totals.total_packed > totals.total_qa_passed) {
    throw new OrderProgressValidationError("Packed quantity cannot exceed QA passed quantity")
  }

  if (totals.total_ready_for_release > totals.total_packed) {
    throw new OrderProgressValidationError("Ready for release quantity cannot exceed packed quantity")
  }

  if (totals.total_released > totals.total_ready_for_release) {
    throw new OrderProgressValidationError("Released quantity cannot exceed ready for release quantity")
  }
}

function totalForStage(totals: ProgressTotalsDto, stage: OrderLineItemProgressStage): number {
  switch (stage) {
    case "printed":
      return totals.total_printed
    case "qa_passed":
      return totals.total_qa_passed
    case "packed":
      return totals.total_packed
    case "ready_for_release":
      return totals.total_ready_for_release
    case "released":
      return totals.total_released
  }
}
