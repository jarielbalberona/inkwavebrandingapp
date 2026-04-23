import { randomUUID } from "node:crypto"

import type { DatabaseClient } from "../../db/client.js"
import type { Cup, Lid } from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { CupsRepository } from "../cups/cups.repository.js"
import { CustomersRepository } from "../customers/customers.repository.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"
import { InventoryService } from "../inventory/inventory.service.js"
import { LidsRepository } from "../lids/lids.repository.js"
import {
  createOrderLineItemProgressEventSchema,
  createOrderSchema,
  orderListQuerySchema,
  updateOrderSchema,
  type CreateOrderInput,
  type CreateOrderLineItemProgressEventInput,
  type OrderListQuery,
  type OrderLineItemProgressStage,
  type OrderStatus,
  type UpdateOrderInput,
} from "./orders.schemas.js"
import { OrdersRepository, type OrderItemWithProgressEvents } from "./orders.repository.js"
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

export class OrderLidNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Lid not found")
  }
}

export class OrderLidInactiveError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Cannot create an order for an inactive lid")
  }
}

export class DuplicateOrderItemError extends Error {
  readonly statusCode = 400

  constructor() {
    super("Duplicate source item in order line items")
  }
}

export class OrderLineItemNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Order line item not found")
  }
}

export class OrderNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Order not found")
  }
}

export class OrderCompletedCancellationError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Completed orders cannot be canceled without an explicit return workflow")
  }
}

export class OrderClosedUpdateError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Canceled or completed orders cannot be edited")
  }
}

export class OrderCustomerReassignmentProgressError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Customer cannot be changed after fulfillment progress has started")
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

export class OrderPrintedQuantityNotReservedError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Printed quantity exceeds remaining reserved stock")
  }
}

const progressStages = [
  "printed",
  "qa_passed",
  "packed",
  "ready_for_release",
  "released",
] as const satisfies readonly OrderLineItemProgressStage[]

type ResolvedOrderLineItem =
  | {
      itemType: "cup"
      cup: Cup
      quantity: number
      notes?: string
    }
  | {
      itemType: "lid"
      lid: Lid
      quantity: number
      notes?: string
    }

export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly cupsRepository: CupsRepository,
    private readonly lidsRepository: LidsRepository,
    private readonly createInventoryService: (db: DatabaseClient) => InventoryService,
  ) {}

  async list(query: OrderListQuery, user: SafeUser): Promise<OrderDto[]> {
    const parsedQuery = orderListQuerySchema.parse(query)
    const orders = await this.ordersRepository.listWithRelations(parsedQuery)

    return orders.map((order) => toOrderDto(order, user))
  }

  async getById(orderId: string, user: SafeUser): Promise<OrderDto> {
    const order = await this.ordersRepository.findByIdWithRelations(orderId)

    if (!order) {
      throw new OrderNotFoundError()
    }

    return toOrderDto(order, user)
  }

  async create(input: CreateOrderInput, user: SafeUser): Promise<OrderDto> {
    const parsedInput = createOrderSchema.parse(input)
    const customer = await this.customersRepository.findById(parsedInput.customer_id)

    if (!customer) {
      throw new OrderCustomerNotFoundError()
    }

    if (!customer.isActive) {
      throw new OrderCustomerInactiveError()
    }

    const seenSourceItems = new Set<string>()

    for (const item of parsedInput.line_items) {
      const key = item.item_type === "cup" ? `cup:${item.cup_id}` : `lid:${item.lid_id}`

      if (seenSourceItems.has(key)) {
        throw new DuplicateOrderItemError()
      }

      seenSourceItems.add(key)
    }

    const resolvedItems = await Promise.all(
      parsedInput.line_items.map(async (item): Promise<ResolvedOrderLineItem> => {
        if (item.item_type === "cup") {
          const cup = await this.cupsRepository.findById(item.cup_id)

          if (!cup) {
            throw new OrderCupNotFoundError()
          }

          if (!cup.isActive) {
            throw new OrderCupInactiveError()
          }

          return {
            itemType: "cup",
            cup,
            quantity: item.quantity,
            notes: item.notes,
          }
        }

        const lid = await this.lidsRepository.findById(item.lid_id)

        if (!lid) {
          throw new OrderLidNotFoundError()
        }

        if (!lid.isActive) {
          throw new OrderLidInactiveError()
        }

        return {
          itemType: "lid",
          lid,
          quantity: item.quantity,
          notes: item.notes,
        }
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
        items: resolvedItems.map((item) => {
          if (item.itemType === "cup") {
            return {
              itemType: "cup",
              cupId: item.cup.id,
              lidId: undefined,
              descriptionSnapshot: item.cup.sku,
              quantity: item.quantity,
              unitCostPrice: item.cup.costPrice,
              unitSellPrice: item.cup.defaultSellPrice,
              notes: item.notes,
            }
          }

          return {
            itemType: "lid",
            cupId: undefined,
            lidId: item.lid.id,
            descriptionSnapshot: buildLidDescriptionSnapshot(item.lid),
            quantity: item.quantity,
            unitCostPrice: item.lid.costPrice,
            unitSellPrice: item.lid.defaultSellPrice,
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
            itemType: item.itemType,
            cupId: item.cupId ?? undefined,
            lidId: item.lidId ?? undefined,
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

    return this.ordersRepository.transaction(async ({ db, ordersRepository }) => {
      const orderItem = await ordersRepository.findOrderItemWithOrder(orderLineItemId)

      if (!orderItem) {
        throw new OrderLineItemNotFoundError()
      }

      if (orderItem.order.status === "canceled") {
        throw new OrderProgressClosedError()
      }

      const existingEvents = await ordersRepository.listProgressEventsForOrderItem(orderLineItemId)
      const nextTotals = calculateProgressTotals(orderItem.quantity, [
        ...existingEvents,
        {
          stage: parsedInput.stage,
          quantity: parsedInput.quantity,
        },
      ])

      validateProgressTotals(orderItem.itemType, orderItem.quantity, nextTotals)

      const event = await ordersRepository.createProgressEvent({
        orderLineItemId,
        stage: parsedInput.stage,
        quantity: parsedInput.quantity,
        note: parsedInput.note,
        eventDate: parsedInput.event_date,
        createdByUserId: user.id,
      })

      const inventoryRepository = new InventoryRepository(db)

      if (orderItem.itemType === "cup" && parsedInput.stage === "printed") {
        const balance = await inventoryRepository.getBalanceByCupId(orderItem.cupId!)

        if (!balance) {
          throw new OrderCupNotFoundError()
        }

        if (balance.reserved < parsedInput.quantity || balance.onHand < parsedInput.quantity) {
          throw new OrderPrintedQuantityNotReservedError()
        }

        await inventoryRepository.appendMovement({
          itemType: "cup",
          cupId: orderItem.cupId!,
          movementType: "consume",
          quantity: parsedInput.quantity,
          orderId: orderItem.orderId,
          orderItemId: orderItem.id,
          note: "Consumed by printed progress event",
          reference: event.id,
          createdByUserId: user.id,
        })
      }

      if (orderItem.itemType === "lid" && parsedInput.stage === "released") {
        const balance = await inventoryRepository.getBalanceByLidId(orderItem.lidId!)

        if (!balance) {
          throw new OrderLidNotFoundError()
        }

        if (balance.reserved < parsedInput.quantity || balance.onHand < parsedInput.quantity) {
          throw new OrderPrintedQuantityNotReservedError()
        }

        await inventoryRepository.appendMovement({
          itemType: "lid",
          lidId: orderItem.lidId!,
          movementType: "consume",
          quantity: parsedInput.quantity,
          orderId: orderItem.orderId,
          orderItemId: orderItem.id,
          note: "Consumed by released lid progress event",
          reference: event.id,
          createdByUserId: user.id,
        })
      }

      const orderItems = await ordersRepository.listOrderItemsWithProgressEvents(orderItem.orderId)
      const orderStatus = deriveOrderStatus(orderItem.order.status, orderItems)

      await ordersRepository.updateOrderStatus(orderItem.orderId, orderStatus)

      const events = [...existingEvents, event]

      return {
        event: toProgressEventDto(event),
        totals: calculateProgressTotals(orderItem.quantity, events),
        order_status: orderStatus,
      }
    })
  }

  async cancel(orderId: string, user: SafeUser): Promise<OrderDto> {
    return this.ordersRepository.transaction(async ({ db, ordersRepository }) => {
      const order = await ordersRepository.findByIdWithRelations(orderId)

      if (!order) {
        throw new OrderNotFoundError()
      }

      if (order.status === "completed") {
        throw new OrderCompletedCancellationError()
      }

      if (order.status === "canceled") {
        return toOrderDto(order, user)
      }

      const inventoryRepository = new InventoryRepository(db)
      const orderItems = await ordersRepository.listOrderItemsWithProgressEvents(order.id)

      for (const item of orderItems) {
        const totals = calculateProgressTotals(item.quantity, item.progressEvents)
        const releaseQuantity =
          item.itemType === "cup"
            ? Math.max(item.quantity - totals.total_printed, 0)
            : Math.max(item.quantity - totals.total_released, 0)

        if (releaseQuantity === 0) {
          continue
        }

        await inventoryRepository.appendMovement({
          itemType: item.itemType,
          cupId: item.cupId ?? undefined,
          lidId: item.lidId ?? undefined,
          movementType: "release_reservation",
          quantity: releaseQuantity,
          orderId: order.id,
          orderItemId: item.id,
          note: "Released unconsumed reservation on order cancellation",
          reference: order.id,
          createdByUserId: user.id,
        })
      }

      await ordersRepository.cancelOrder(order.id)

      const canceledOrder = await ordersRepository.findByIdWithRelations(order.id)

      if (!canceledOrder) {
        throw new OrderNotFoundError()
      }

      return toOrderDto(canceledOrder, user)
    })
  }

  async update(orderId: string, input: UpdateOrderInput, user: SafeUser): Promise<OrderDto> {
    const parsedInput = updateOrderSchema.parse(input)

    return this.ordersRepository.transaction(async ({ db, ordersRepository }) => {
      const order = await ordersRepository.findByIdWithRelations(orderId)

      if (!order) {
        throw new OrderNotFoundError()
      }

      if (order.status === "canceled" || order.status === "completed") {
        throw new OrderClosedUpdateError()
      }

      if (parsedInput.customer_id && parsedInput.customer_id !== order.customerId) {
        const customer = await new CustomersRepository(db).findById(parsedInput.customer_id)

        if (!customer) {
          throw new OrderCustomerNotFoundError()
        }

        if (!customer.isActive) {
          throw new OrderCustomerInactiveError()
        }

        const orderItems = await ordersRepository.listOrderItemsWithProgressEvents(order.id)

        if (hasFulfillmentProgress(orderItems)) {
          throw new OrderCustomerReassignmentProgressError()
        }
      }

      await ordersRepository.updateOrderMetadata(order.id, {
        customerId: parsedInput.customer_id,
        notes: parsedInput.notes,
      })

      const updatedOrder = await ordersRepository.findByIdWithRelations(order.id)

      if (!updatedOrder) {
        throw new OrderNotFoundError()
      }

      return toOrderDto(updatedOrder, user)
    })
  }
}

function createOrderNumber(): string {
  const datePrefix = new Date().toISOString().slice(0, 10).replaceAll("-", "")

  return `IW-${datePrefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function buildLidDescriptionSnapshot(lid: Lid): string {
  return `${lid.type} ${lid.brand} ${lid.diameter} ${lid.shape} ${lid.color}`
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

function validateProgressTotals(
  itemType: "cup" | "lid",
  orderedQuantity: number,
  totals: ProgressTotalsDto,
) {
  for (const stage of progressStages) {
    const total = totalForStage(totals, stage)

    if (total > orderedQuantity) {
      throw new OrderProgressValidationError(`${stage} total cannot exceed ordered quantity`)
    }
  }

  if (itemType === "lid") {
    if (
      totals.total_printed > 0 ||
      totals.total_qa_passed > 0 ||
      totals.total_packed > 0 ||
      totals.total_ready_for_release > 0
    ) {
      throw new OrderProgressValidationError(
        "Lid line items only support released quantity events",
      )
    }

    return
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

function deriveOrderStatus(
  currentStatus: OrderStatus,
  items: OrderItemWithProgressEvents[],
): OrderStatus {
  if (currentStatus === "canceled") {
    return "canceled"
  }

  let hasAnyProgress = false
  let hasAnyReleased = false
  let allLineItemsReleased = items.length > 0

  for (const item of items) {
    const totals = calculateProgressTotals(item.quantity, item.progressEvents)
    const itemProgressTotal =
      totals.total_printed +
      totals.total_qa_passed +
      totals.total_packed +
      totals.total_ready_for_release +
      totals.total_released

    if (itemProgressTotal > 0) {
      hasAnyProgress = true
    }

    if (totals.total_released > 0) {
      hasAnyReleased = true
    }

    if (totals.total_released < item.quantity) {
      allLineItemsReleased = false
    }
  }

  if (allLineItemsReleased) {
    return "completed"
  }

  if (hasAnyReleased) {
    return "partial_released"
  }

  if (hasAnyProgress) {
    return "in_progress"
  }

  return "pending"
}

function hasFulfillmentProgress(items: OrderItemWithProgressEvents[]): boolean {
  return items.some((item) => item.progressEvents.length > 0)
}
