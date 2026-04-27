import { randomUUID } from "node:crypto"

import type { DatabaseClient } from "../../db/client.js"
import type {
  Cup,
  Lid,
  NonStockItem,
  ProductBundle,
} from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { assertPermission } from "../auth/authorization.js"
import { CupsRepository } from "../cups/cups.repository.js"
import { CustomersRepository } from "../customers/customers.repository.js"
import { InventoryRepository } from "../inventory/inventory.repository.js"
import { InventoryService } from "../inventory/inventory.service.js"
import { InvoicesRepository } from "../invoices/invoices.repository.js"
import {
  assertInvoiceAllowsStructuralChanges,
  InvoicePaidLockError,
  InvoicePaymentLockError,
  syncInvoiceSnapshotForOrder,
} from "../invoices/invoices.service.js"
import { LidsRepository } from "../lids/lids.repository.js"
import { NonStockItemsRepository } from "../non-stock-items/non-stock-items.repository.js"
import { ProductBundlesRepository } from "../product-bundles/product-bundles.repository.js"
import { toProductBundleInventoryComponents } from "../product-bundles/product-bundles.composition.js"
import { SellableProductPriceRulesRepository } from "../sellable-product-price-rules/sellable-product-price-rules.repository.js"
import { findMatchingActiveRange } from "../sellable-product-price-rules/sellable-product-price-rules.ranges.js"
import {
  createOrderLineItemProgressEventSchema,
  createOrderSchema,
  orderListQuerySchema,
  updateOrderSchema,
  updateOrderPrioritiesSchema,
  type CreateOrderInput,
  type CreateOrderLineItemProgressEventInput,
  type OrderListQuery,
  type OrderLineItemProgressStage,
  type OrderStatus,
  type ProgressEventsQuery,
  type UpdateOrderInput,
  type UpdateOrderPrioritiesInput,
} from "./orders.schemas.js"
import {
  OrdersRepository,
  type OrderItemWithProgressEvents,
  type OrderWithRelations,
} from "./orders.repository.js"
import {
  toOrderDto,
  toProgressEventDto,
  type OrderDto,
  type OrderLineItemDerivedStatus,
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

export interface OrderCreateLineItemErrorDetail {
  lineItemIndex: number
  itemType:
    | "cup"
    | "lid"
    | "non_stock_item"
    | "custom_charge"
    | "product_bundle"
  itemId?: string
  field:
    | "item_id"
    | "quantity"
    | "description_snapshot"
    | "unit_sell_price"
    | "unit_cost_price"
  message: string
  requestedQuantity?: number
  availableQuantity?: number
  itemLabel?: string
}

export class OrderCreateValidationError extends Error {
  readonly statusCode: number
  readonly details: OrderCreateLineItemErrorDetail[]

  constructor(
    message: string,
    statusCode: number,
    details: OrderCreateLineItemErrorDetail[]
  ) {
    super(message)
    this.statusCode = statusCode
    this.details = details
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
    super(
      "Completed orders cannot be canceled without an explicit return workflow"
    )
  }
}

export class OrderClosedUpdateError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Canceled or completed orders cannot be edited")
  }
}

export class OrderArchivedError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Archived orders cannot be changed")
  }
}

export class OrderArchiveStatusError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Only canceled orders can be archived")
  }
}

export class OrderStructuralEditStatusError extends Error {
  readonly statusCode = 409

  constructor() {
    super(
      "Structural order edits are only allowed while the order is pending or in progress"
    )
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

export class OrderPriorityValidationError extends Error {
  readonly statusCode = 404

  constructor(message: string) {
    super(message)
  }
}

export class OrderPrintedQuantityNotReservedError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Fulfillment quantity exceeds remaining reserved stock")
  }
}

export class OrderPrintedQuantityInsufficientStockError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Printed quantity exceeds current on-hand stock")
  }
}

export class OrderLineItemProgressLockedError extends Error {
  readonly statusCode = 409

  constructor(message: string) {
    super(message)
  }
}

const cupProgressStages = [
  "printed",
  "qa_passed",
  "packed",
  "ready_for_release",
  "released",
] as const satisfies readonly OrderLineItemProgressStage[]

const lidProgressStages = [
  "packed",
  "ready_for_release",
  "released",
] as const satisfies readonly OrderLineItemProgressStage[]

type ResolvedOrderLineItem =
  | {
      requestLineItemIndex: number
      itemType: "cup"
      cup: Cup
      quantity: number
      notes?: string
    }
  | {
      requestLineItemIndex: number
      itemType: "lid"
      lid: Lid
      quantity: number
      notes?: string
    }
  | {
      requestLineItemIndex: number
      itemType: "non_stock_item"
      nonStockItem: NonStockItem
      quantity: number
      notes?: string
    }
  | {
      requestLineItemIndex: number
      itemType: "product_bundle"
      productBundle: ProductBundle
      quantity: number
      unitSellPrice: string
      unitCostPrice: string
      componentReservations: InventoryComponentReservation[]
      notes?: string
    }
  | {
      requestLineItemIndex: number
      itemType: "custom_charge"
      descriptionSnapshot: string
      quantity: number
      unitSellPrice: string
      unitCostPrice: string
      notes?: string
    }

type CreateOrderLineItemInput = CreateOrderInput["line_items"][number]
type UpdateOrderLineItemInput = NonNullable<
  UpdateOrderInput["line_items"]
>[number]

type OrderInventoryItemType = "cup" | "lid"
type OrderTrackedLineItemType = "cup" | "lid" | "product_bundle"
type OrderProgressComponentItemType = "cup" | "lid"

interface InventoryComponentReservation {
  itemType: OrderInventoryItemType
  cupId?: string
  lidId?: string
  quantity: number
}

interface ExistingTrackedItemProgress {
  hasProgress: boolean
  consumedQuantity: number
  minimumAllowedQuantity: number
}

function assertNoDuplicateSourceItems(
  items: Array<CreateOrderLineItemInput | UpdateOrderLineItemInput>
): void {
  const duplicateIndexesByKey = new Map<string, number[]>()

  for (const [index, item] of items.entries()) {
    if (item.item_type === "custom_charge") {
      continue
    }

    const key =
      item.item_type === "cup"
        ? `cup:${item.cup_id}`
        : item.item_type === "lid"
          ? `lid:${item.lid_id}`
          : item.item_type === "non_stock_item"
            ? `non_stock_item:${item.non_stock_item_id}`
            : `product_bundle:${item.product_bundle_id}`
    const duplicateIndexes = duplicateIndexesByKey.get(key) ?? []
    duplicateIndexes.push(index)
    duplicateIndexesByKey.set(key, duplicateIndexes)
  }

  const duplicateLineItemDetails = Array.from(
    duplicateIndexesByKey.entries()
  ).flatMap(([key, indexes]) => {
    if (indexes.length < 2) {
      return []
    }

    const [itemType, itemId] = key.split(":") as [
      "cup" | "lid" | "non_stock_item" | "product_bundle",
      string,
    ]

    return indexes.map((lineItemIndex) => ({
      lineItemIndex,
      itemType,
      itemId,
      field: "item_id" as const,
      message: `Line item ${lineItemIndex + 1} duplicates another selected ${itemType}. Each source item can only appear once per order.`,
    }))
  })

  if (duplicateLineItemDetails.length > 0) {
    throw new OrderCreateValidationError(
      "Duplicate source items found in order line items",
      400,
      duplicateLineItemDetails
    )
  }
}

async function resolveOrderLineItems(
  items: Array<CreateOrderLineItemInput | UpdateOrderLineItemInput>,
  dependencies: {
    cupsRepository: CupsRepository
    lidsRepository: LidsRepository
    nonStockItemsRepository: NonStockItemsRepository
    productBundlesRepository: ProductBundlesRepository
    sellableProductPriceRulesRepository: SellableProductPriceRulesRepository
    user: SafeUser
  }
): Promise<ResolvedOrderLineItem[]> {
  assertNoDuplicateSourceItems(items)

  const resolvedItems: ResolvedOrderLineItem[] = []

  for (const [index, item] of items.entries()) {
    if (item.item_type === "cup") {
      const cup = await dependencies.cupsRepository.findById(item.cup_id)

      if (!cup) {
        throw new OrderCreateValidationError(
          "Some order line items are invalid",
          404,
          [
            {
              lineItemIndex: index,
              itemType: "cup",
              itemId: item.cup_id,
              field: "item_id",
              message: `Line item ${index + 1} references a cup that no longer exists.`,
            },
          ]
        )
      }

      if (!cup.isActive) {
        throw new OrderCreateValidationError(
          "Some order line items are invalid",
          409,
          [
            {
              lineItemIndex: index,
              itemType: "cup",
              itemId: item.cup_id,
              field: "item_id",
              itemLabel: cup.sku,
              message: `Line item ${index + 1} uses inactive cup ${cup.sku}.`,
            },
          ]
        )
      }

      resolvedItems.push({
        requestLineItemIndex: index,
        itemType: "cup",
        cup,
        quantity: item.quantity,
        notes: item.notes,
      })
      continue
    }

    if (item.item_type === "lid") {
      const lid = await dependencies.lidsRepository.findById(item.lid_id)

      if (!lid) {
        throw new OrderCreateValidationError(
          "Some order line items are invalid",
          404,
          [
            {
              lineItemIndex: index,
              itemType: "lid",
              itemId: item.lid_id,
              field: "item_id",
              message: `Line item ${index + 1} references a lid that no longer exists.`,
            },
          ]
        )
      }

      if (!lid.isActive) {
        const lidLabel =
          lid.sku.trim() ||
          `${lid.brand} ${lid.diameter} ${lid.shape} ${lid.color}`
        throw new OrderCreateValidationError(
          "Some order line items are invalid",
          409,
          [
            {
              lineItemIndex: index,
              itemType: "lid",
              itemId: item.lid_id,
              field: "item_id",
              itemLabel: lidLabel,
              message: `Line item ${index + 1} uses inactive lid ${lidLabel}.`,
            },
          ]
        )
      }

      resolvedItems.push({
        requestLineItemIndex: index,
        itemType: "lid",
        lid,
        quantity: item.quantity,
        notes: item.notes,
      })
      continue
    }

    if (item.item_type === "non_stock_item") {
      const nonStockItem = await dependencies.nonStockItemsRepository.findById(
        item.non_stock_item_id
      )

      if (!nonStockItem) {
        throw new OrderCreateValidationError(
          "Some order line items are invalid",
          404,
          [
            {
              lineItemIndex: index,
              itemType: "non_stock_item",
              itemId: item.non_stock_item_id,
              field: "item_id",
              message: `Line item ${index + 1} references a general item that no longer exists.`,
            },
          ]
        )
      }

      if (!nonStockItem.isActive) {
        throw new OrderCreateValidationError(
          "Some order line items are invalid",
          409,
          [
            {
              lineItemIndex: index,
              itemType: "non_stock_item",
              itemId: item.non_stock_item_id,
              field: "item_id",
              itemLabel: nonStockItem.name,
              message: `Line item ${index + 1} uses inactive general item ${nonStockItem.name}.`,
            },
          ]
        )
      }

      resolvedItems.push({
        requestLineItemIndex: index,
        itemType: "non_stock_item",
        nonStockItem,
        quantity: item.quantity,
        notes: item.notes,
      })
      continue
    }

    if (item.item_type === "product_bundle") {
      const productBundle =
        await dependencies.productBundlesRepository.findById(
          item.product_bundle_id
        )

      if (!productBundle) {
        throw new OrderCreateValidationError(
          "Some order line items are invalid",
          404,
          [
            {
              lineItemIndex: index,
              itemType: "product_bundle",
              itemId: item.product_bundle_id,
              field: "item_id",
              message: `Line item ${index + 1} references a product bundle that no longer exists.`,
            },
          ]
        )
      }

      if (!productBundle.isActive) {
        throw new OrderCreateValidationError(
          "Some order line items are invalid",
          409,
          [
            {
              lineItemIndex: index,
              itemType: "product_bundle",
              itemId: item.product_bundle_id,
              field: "item_id",
              itemLabel: productBundle.name,
              message: `Line item ${index + 1} uses inactive product bundle ${productBundle.name}.`,
            },
          ]
        )
      }

      const components = resolveProductBundleInventoryComponents({
        lineItemIndex: index,
        productBundle,
        quantity: item.quantity,
      })
      const componentCostPrice = await resolveProductBundleUnitCostPrice({
        lineItemIndex: index,
        productBundle,
        cupsRepository: dependencies.cupsRepository,
        lidsRepository: dependencies.lidsRepository,
      })
      const unitSellPrice =
        item.unit_sell_price ??
        (await resolveProductBundleDefaultUnitSellPrice({
          lineItemIndex: index,
          productBundle,
          quantity: item.quantity,
          sellableProductPriceRulesRepository:
            dependencies.sellableProductPriceRulesRepository,
        }))

      if (item.unit_sell_price) {
        assertPermission(dependencies.user, "orders.pricing.view")
      }

      resolvedItems.push({
        requestLineItemIndex: index,
        itemType: "product_bundle",
        productBundle,
        quantity: item.quantity,
        unitSellPrice,
        unitCostPrice: componentCostPrice,
        componentReservations: components,
        notes: item.notes,
      })
      continue
    }

    resolvedItems.push({
      requestLineItemIndex: index,
      itemType: "custom_charge",
      descriptionSnapshot: item.description_snapshot.trim(),
      quantity: item.quantity,
      unitSellPrice: item.unit_sell_price,
      unitCostPrice: item.unit_cost_price ?? "0.00",
      notes: item.notes,
    })
  }

  return resolvedItems
}

function resolveProductBundleInventoryComponents(input: {
  lineItemIndex: number
  productBundle: ProductBundle
  quantity: number
}): InventoryComponentReservation[] {
  try {
    return toProductBundleInventoryComponents(
      input.productBundle,
      input.quantity
    ).map((component) => {
      if (component.itemType === "cup") {
        return {
          itemType: "cup" as const,
          cupId: component.itemId,
          quantity: component.quantity,
        }
      }

      return {
        itemType: "lid" as const,
        lidId: component.itemId,
        quantity: component.quantity,
      }
    })
  } catch (error) {
    throw new OrderCreateValidationError(
      "Some order line items are invalid",
      409,
      [
        {
          lineItemIndex: input.lineItemIndex,
          itemType: "product_bundle",
          itemId: input.productBundle.id,
          field: "item_id",
          itemLabel: input.productBundle.name,
          message:
            error instanceof Error
              ? error.message
              : "Product bundle composition is invalid.",
        },
      ]
    )
  }
}

async function resolveProductBundleUnitCostPrice(input: {
  lineItemIndex: number
  productBundle: ProductBundle
  cupsRepository: CupsRepository
  lidsRepository: LidsRepository
}): Promise<string> {
  let unitCostPrice = 0

  if (input.productBundle.cupId) {
    const cup = await input.cupsRepository.findById(input.productBundle.cupId)

    if (!cup || !cup.isActive) {
      throw new OrderCreateValidationError(
        "Some order line items are invalid",
        cup ? 409 : 404,
        [
          {
            lineItemIndex: input.lineItemIndex,
            itemType: "product_bundle",
            itemId: input.productBundle.id,
            field: "item_id",
            itemLabel: input.productBundle.name,
            message: `Line item ${input.lineItemIndex + 1} references a product bundle with an unavailable cup component.`,
          },
        ]
      )
    }

    unitCostPrice += Number(cup.costPrice) * input.productBundle.cupQtyPerSet
  }

  if (input.productBundle.lidId) {
    const lid = await input.lidsRepository.findById(input.productBundle.lidId)

    if (!lid || !lid.isActive) {
      throw new OrderCreateValidationError(
        "Some order line items are invalid",
        lid ? 409 : 404,
        [
          {
            lineItemIndex: input.lineItemIndex,
            itemType: "product_bundle",
            itemId: input.productBundle.id,
            field: "item_id",
            itemLabel: input.productBundle.name,
            message: `Line item ${input.lineItemIndex + 1} references a product bundle with an unavailable lid component.`,
          },
        ]
      )
    }

    unitCostPrice += Number(lid.costPrice) * input.productBundle.lidQtyPerSet
  }

  return unitCostPrice.toFixed(2)
}

async function resolveProductBundleDefaultUnitSellPrice(input: {
  lineItemIndex: number
  productBundle: ProductBundle
  quantity: number
  sellableProductPriceRulesRepository: SellableProductPriceRulesRepository
}): Promise<string> {
  const activeRules =
    await input.sellableProductPriceRulesRepository.listActiveByProductBundle(
      input.productBundle.id
    )
  let matchingRule

  try {
    matchingRule = findMatchingActiveRange(input.quantity, activeRules)
  } catch (error) {
    throw new OrderCreateValidationError(
      "Some order line items are invalid",
      409,
      [
        {
          lineItemIndex: input.lineItemIndex,
          itemType: "product_bundle",
          itemId: input.productBundle.id,
          field: "unit_sell_price",
          itemLabel: input.productBundle.name,
          message:
            error instanceof Error
              ? error.message
              : "Product bundle pricing rules are invalid.",
        },
      ]
    )
  }

  if (!matchingRule) {
    throw new OrderCreateValidationError(
      "Some order line items are invalid",
      409,
      [
        {
          lineItemIndex: input.lineItemIndex,
          itemType: "product_bundle",
          itemId: input.productBundle.id,
          field: "unit_sell_price",
          itemLabel: input.productBundle.name,
          message: `Line item ${input.lineItemIndex + 1} has no active default price rule for quantity ${input.quantity}. Enter an authorized override price or configure pricing first.`,
        },
      ]
    )
  }

  return matchingRule.unitPrice
}

export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly cupsRepository: CupsRepository,
    private readonly lidsRepository: LidsRepository,
    private readonly nonStockItemsRepository: NonStockItemsRepository,
    private readonly productBundlesRepository: ProductBundlesRepository,
    private readonly sellableProductPriceRulesRepository: SellableProductPriceRulesRepository,
    private readonly createInventoryService: (
      db: DatabaseClient
    ) => InventoryService
  ) {}

  async list(query: OrderListQuery, user: SafeUser): Promise<OrderDto[]> {
    assertPermission(user, "orders.view")

    const parsedQuery = orderListQuerySchema.parse(query)
    const orders = await this.listOrdersWithEmptyStateFallback({
      status: parsedQuery.status,
      includeArchived: parsedQuery.include_archived,
    })

    return orders.map((order) => toOrderDto(order, user))
  }

  private async listOrdersWithEmptyStateFallback(query: {
    status?: OrderStatus
    includeArchived?: boolean
  }) {
    try {
      return await this.ordersRepository.listWithRelations(query)
    } catch (error) {
      if (!(await this.shouldReturnEmptyOrderList(error))) {
        throw error
      }

      return []
    }
  }

  private async shouldReturnEmptyOrderList(error: unknown): Promise<boolean> {
    if (!isRecoverableOrderListSchemaError(error)) {
      return false
    }

    try {
      return !(await this.ordersRepository.hasAnyOrders())
    } catch {
      return false
    }
  }

  async getById(orderId: string, user: SafeUser): Promise<OrderDto> {
    assertPermission(user, "orders.view")

    const order = await this.ordersRepository.findByIdWithRelations(orderId)

    if (!order) {
      throw new OrderNotFoundError()
    }

    return toOrderDto(order, user)
  }

  async create(input: CreateOrderInput, user: SafeUser): Promise<OrderDto> {
    assertPermission(user, "orders.manage")

    const parsedInput = createOrderSchema.parse(input)
    const customer = await this.customersRepository.findById(
      parsedInput.customer_id
    )

    if (!customer) {
      throw new OrderCustomerNotFoundError()
    }

    if (!customer.isActive) {
      throw new OrderCustomerInactiveError()
    }

    const includesCustomCharge = parsedInput.line_items.some(
      (item) => item.item_type === "custom_charge"
    )

    if (includesCustomCharge) {
      assertPermission(user, "orders.custom_charges.manage")
    }

    const resolvedItems = await resolveOrderLineItems(parsedInput.line_items, {
      cupsRepository: this.cupsRepository,
      lidsRepository: this.lidsRepository,
      nonStockItemsRepository: this.nonStockItemsRepository,
      productBundlesRepository: this.productBundlesRepository,
      sellableProductPriceRulesRepository:
        this.sellableProductPriceRulesRepository,
      user,
    })

    return this.ordersRepository.transaction(
      async ({ db, ordersRepository }) => {
        const order = await ordersRepository.createOrderWithItems({
          order: {
            orderNumber: createOrderNumber(),
            customerId: parsedInput.customer_id,
            priority: ((await ordersRepository.getMinimumPriority()) ?? 0) - 1,
            status: "pending",
            notes: parsedInput.notes,
            createdByUserId: user.id,
          },
          items: resolvedItems.map((item) => {
            return toOrderItemInsert(item)
          }),
        })

        await syncInvoiceSnapshotForOrder(
          new InvoicesRepository(db),
          order,
          user.id
        )

        const reservationRequests = buildReservationRequestsForResolvedItems(
          order,
          resolvedItems
        )

        if (reservationRequests.length > 0) {
          await this.createInventoryService(db).reserveOrderItems(
            {
              orderId: order.id,
              createdByUserId: user.id,
              items: reservationRequests,
            },
            { useExistingTransaction: true }
          )

          return toOrderDto(order, user)
        }

        await ordersRepository.updateOrderStatus(order.id, "completed")

        const completedOrder = await ordersRepository.findByIdWithRelations(
          order.id
        )

        if (!completedOrder) {
          throw new OrderNotFoundError()
        }

        return toOrderDto(completedOrder, user)
      }
    )
  }

  async listProgressEvents(
    orderLineItemId: string,
    user: SafeUser,
    query: ProgressEventsQuery = {}
  ) {
    assertPermission(user, "orders.view")

    const orderItem =
      await this.ordersRepository.findOrderItemWithOrder(orderLineItemId)

    if (!orderItem) {
      throw new OrderLineItemNotFoundError()
    }

    if (
      orderItem.itemType === "non_stock_item" ||
      orderItem.itemType === "custom_charge"
    ) {
      throw new OrderProgressValidationError(
        "Non-stock and custom charge line items do not support fulfillment progress events"
      )
    }

    const componentItemType = resolveProgressComponentItemType(
      orderItem,
      query.component_item_type
    )
    const events = await this.ordersRepository.listProgressEventsForOrderItem(
      orderLineItemId,
      {
        componentItemType,
      }
    )

    return {
      events: events.map(toProgressEventDto),
      totals: calculateProgressTotals(
        orderItem.itemType,
        orderItem.quantity,
        events,
        componentItemType
      ),
    }
  }

  async createProgressEvent(
    orderLineItemId: string,
    input: CreateOrderLineItemProgressEventInput,
    user: SafeUser
  ) {
    assertPermission(user, "orders.fulfillment.record")

    const parsedInput = createOrderLineItemProgressEventSchema.parse(input)

    return this.ordersRepository.transaction(
      async ({ db, ordersRepository }) => {
        const orderItem =
          await ordersRepository.findOrderItemWithOrder(orderLineItemId)

        if (!orderItem) {
          throw new OrderLineItemNotFoundError()
        }

        if (
          orderItem.itemType === "non_stock_item" ||
          orderItem.itemType === "custom_charge"
        ) {
          throw new OrderProgressValidationError(
            "Non-stock and custom charge line items do not support fulfillment progress events"
          )
        }

        if (orderItem.order.status === "canceled") {
          throw new OrderProgressClosedError()
        }

        const componentItemType = resolveProgressComponentItemType(
          orderItem,
          parsedInput.component_item_type
        )
        const existingEvents =
          await ordersRepository.listProgressEventsForOrderItem(
            orderLineItemId,
            {
              componentItemType,
            }
          )
        const currentTotals = calculateProgressTotals(
          orderItem.itemType,
          orderItem.quantity,
          existingEvents,
          componentItemType
        )
        const nextTotals = calculateProgressTotals(
          orderItem.itemType,
          orderItem.quantity,
          [
            ...existingEvents,
            {
              stage: parsedInput.stage,
              quantity: parsedInput.quantity,
            },
          ],
          componentItemType
        )

        validateProgressTotals(
          orderItem.itemType,
          orderItem.quantity,
          nextTotals,
          componentItemType
        )

        const event = await ordersRepository.createProgressEvent({
          orderLineItemId,
          componentItemType,
          stage: parsedInput.stage,
          quantity: parsedInput.quantity,
          note: parsedInput.note,
          eventDate: parsedInput.event_date,
          createdByUserId: user.id,
        })

        const inventoryRepository = new InventoryRepository(db)

        if (orderItem.itemType === "cup" && parsedInput.stage === "printed") {
          const balance = await inventoryRepository.getBalanceByCupId(
            orderItem.cupId!
          )

          if (!balance) {
            throw new OrderCupNotFoundError()
          }

          if (balance.onHand < parsedInput.quantity) {
            throw new OrderPrintedQuantityInsufficientStockError()
          }

          const lineItemReservedRemaining = Math.max(
            orderItem.quantity - currentTotals.total_printed,
            0
          )
          const reservedQuantityToConsume = Math.min(
            lineItemReservedRemaining,
            parsedInput.quantity
          )
          const overrunQuantityToDeduct =
            parsedInput.quantity - reservedQuantityToConsume

          if (balance.reserved < reservedQuantityToConsume) {
            throw new OrderPrintedQuantityNotReservedError()
          }

          if (reservedQuantityToConsume > 0) {
            await inventoryRepository.appendMovement({
              itemType: "cup",
              cupId: orderItem.cupId!,
              movementType: "consume",
              quantity: reservedQuantityToConsume,
              orderId: orderItem.orderId,
              orderItemId: orderItem.id,
              note: "Consumed reserved stock by printed progress event",
              reference: event.id,
              createdByUserId: user.id,
            })
          }

          if (overrunQuantityToDeduct > 0) {
            await inventoryRepository.appendMovement({
              itemType: "cup",
              cupId: orderItem.cupId!,
              movementType: "adjustment_out",
              quantity: overrunQuantityToDeduct,
              orderId: orderItem.orderId,
              orderItemId: orderItem.id,
              note: "Deducted printed overrun stock outside reservation",
              reference: event.id,
              createdByUserId: user.id,
            })
          }
        }

        if (orderItem.itemType === "lid" && parsedInput.stage === "released") {
          const balance = await inventoryRepository.getBalanceByLidId(
            orderItem.lidId!
          )

          if (!balance) {
            throw new OrderLidNotFoundError()
          }

          if (
            balance.reserved < parsedInput.quantity ||
            balance.onHand < parsedInput.quantity
          ) {
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

        if (orderItem.itemType === "product_bundle") {
          const componentsToConsume =
            getProductBundleProgressConsumptionComponents(
              orderItem,
              parsedInput.stage,
              parsedInput.quantity,
              componentItemType
            )

          for (const component of componentsToConsume) {
            const balance =
              component.itemType === "cup"
                ? await inventoryRepository.getBalanceByCupId(component.cupId!)
                : await inventoryRepository.getBalanceByLidId(component.lidId!)

            if (!balance) {
              throw component.itemType === "cup"
                ? new OrderCupNotFoundError()
                : new OrderLidNotFoundError()
            }

            if (
              balance.reserved < component.quantity ||
              balance.onHand < component.quantity
            ) {
              throw new OrderPrintedQuantityNotReservedError()
            }

            await inventoryRepository.appendMovement({
              itemType: component.itemType,
              cupId: component.cupId,
              lidId: component.lidId,
              movementType: "consume",
              quantity: component.quantity,
              orderId: orderItem.orderId,
              orderItemId: orderItem.id,
              note: `Consumed reserved ${component.itemType} stock by bundle ${parsedInput.stage} progress event`,
              reference: event.id,
              createdByUserId: user.id,
            })
          }
        }

        const orderItems =
          await ordersRepository.listOrderItemsWithProgressEvents(
            orderItem.orderId
          )
        const orderStatus = deriveOrderStatus(
          orderItem.order.status,
          orderItems
        )

        await ordersRepository.updateOrderStatus(orderItem.orderId, orderStatus)

        const events = [...existingEvents, event]

        return {
          event: toProgressEventDto(event),
          totals: calculateProgressTotals(
            orderItem.itemType,
            orderItem.quantity,
            events,
            componentItemType
          ),
          order_status: orderStatus,
        }
      }
    )
  }

  async cancel(orderId: string, user: SafeUser): Promise<OrderDto> {
    assertPermission(user, "orders.manage")

    return this.ordersRepository.transaction(
      async ({ db, ordersRepository }) => {
        const order = await ordersRepository.findByIdWithRelations(orderId)

        if (!order) {
          throw new OrderNotFoundError()
        }

        if (order.archivedAt) {
          throw new OrderArchivedError()
        }

        if (order.status === "completed") {
          throw new OrderCompletedCancellationError()
        }

        if (order.status === "canceled") {
          return toOrderDto(order, user)
        }

        const inventoryRepository = new InventoryRepository(db)
        const invoicesRepository = new InvoicesRepository(db)
        const existingInvoice = await invoicesRepository.findByOrderId(order.id)

        if (existingInvoice?.status === "paid") {
          throw new InvoicePaidLockError()
        }

        if (
          existingInvoice?.status === "pending" &&
          hasRecordedInvoicePayment(existingInvoice.paidAmount)
        ) {
          throw new InvoicePaymentLockError()
        }

        const orderItems =
          await ordersRepository.listOrderItemsWithProgressEvents(order.id)

        for (const item of orderItems) {
          if (
            item.itemType === "non_stock_item" ||
            item.itemType === "custom_charge"
          ) {
            continue
          }

          for (const component of getCancellationReleaseComponents(item)) {
            await inventoryRepository.appendMovement({
              itemType: component.itemType,
              cupId: component.cupId,
              lidId: component.lidId,
              movementType: "release_reservation",
              quantity: component.quantity,
              orderId: order.id,
              orderItemId: item.id,
              note: "Released unconsumed reservation on order cancellation",
              reference: order.id,
              createdByUserId: user.id,
            })
          }
        }

        await ordersRepository.cancelOrder(order.id)

        const canceledOrder = await ordersRepository.findByIdWithRelations(
          order.id
        )

        if (!canceledOrder) {
          throw new OrderNotFoundError()
        }

        return toOrderDto(canceledOrder, user)
      }
    )
  }

  async update(
    orderId: string,
    input: UpdateOrderInput,
    user: SafeUser
  ): Promise<OrderDto> {
    assertPermission(user, "orders.manage")

    const parsedInput = updateOrderSchema.parse(input)

    return this.ordersRepository.transaction(
      async ({ db, ordersRepository }) => {
        const order = await ordersRepository.findByIdWithRelations(orderId)

        if (!order) {
          throw new OrderNotFoundError()
        }

        if (order.archivedAt) {
          throw new OrderArchivedError()
        }

        const hasStructuralChanges =
          parsedInput.customer_id !== undefined ||
          parsedInput.line_items !== undefined

        if (
          !hasStructuralChanges &&
          (order.status === "canceled" || order.status === "completed")
        ) {
          throw new OrderClosedUpdateError()
        }

        if (
          hasStructuralChanges &&
          order.status !== "pending" &&
          order.status !== "in_progress"
        ) {
          throw new OrderStructuralEditStatusError()
        }

        const invoicesRepository = new InvoicesRepository(db)
        const existingInvoice = await invoicesRepository.findByOrderId(order.id)

        if (hasStructuralChanges && existingInvoice) {
          assertInvoiceAllowsStructuralChanges({
            status: existingInvoice.status,
            paidAmount: existingInvoice.paidAmount,
          })
        }

        if (
          parsedInput.customer_id &&
          parsedInput.customer_id !== order.customerId
        ) {
          const customer = await new CustomersRepository(db).findById(
            parsedInput.customer_id
          )

          if (!customer) {
            throw new OrderCustomerNotFoundError()
          }

          if (!customer.isActive) {
            throw new OrderCustomerInactiveError()
          }

          const orderItems =
            await ordersRepository.listOrderItemsWithProgressEvents(order.id)

          if (hasFulfillmentProgress(orderItems)) {
            throw new OrderCustomerReassignmentProgressError()
          }
        }

        if (parsedInput.line_items) {
          const includesCustomCharge = parsedInput.line_items.some(
            (item) => item.item_type === "custom_charge"
          )

          if (includesCustomCharge) {
            assertPermission(user, "orders.custom_charges.manage")
          }

          const resolvedItems = await resolveOrderLineItems(
            parsedInput.line_items,
            {
              cupsRepository: new CupsRepository(db),
              lidsRepository: new LidsRepository(db),
              nonStockItemsRepository: new NonStockItemsRepository(db),
              productBundlesRepository: new ProductBundlesRepository(db),
              sellableProductPriceRulesRepository:
                new SellableProductPriceRulesRepository(db),
              user,
            }
          )
          const existingOrderItems =
            await ordersRepository.listOrderItemsWithProgressEvents(order.id)
          const existingItemsById = new Map(
            existingOrderItems.map((item) => [item.id, item])
          )
          const seenExistingIds = new Set<string>()

          const itemsToUpdateInPlace: Array<{
            orderItemId: string
            item: Omit<ReturnType<typeof toOrderItemInsert>, "orderId">
          }> = []
          const itemsToCreate: Array<
            Omit<ReturnType<typeof toOrderItemInsert>, "orderId">
          > = []
          const orderItemIdsToDelete: string[] = []
          const reservationAdjustments: Array<{
            action: "reserve" | "release"
            itemType: "cup" | "lid"
            cupId?: string
            lidId?: string
            orderItemId?: string
            quantity: number
            requestLineItemIndex: number
          }> = []

          for (const [index, inputItem] of parsedInput.line_items.entries()) {
            const resolvedItem = resolvedItems[index]

            if (!resolvedItem) {
              throw new Error("Resolved order line item missing")
            }

            const persistedItem = toOrderItemInsert(resolvedItem)
            const existingItemId = "id" in inputItem ? inputItem.id : undefined

            if (!existingItemId) {
              itemsToCreate.push(persistedItem)
              pushReservationAdjustmentsFromComponents(
                reservationAdjustments,
                "reserve",
                getReservationComponentsForResolvedItem(resolvedItem),
                index
              )

              continue
            }

            if (seenExistingIds.has(existingItemId)) {
              throw new OrderCreateValidationError(
                "Duplicate source items found in order line items",
                400,
                [
                  {
                    lineItemIndex: index,
                    itemType: persistedItem.itemType,
                    itemId: getPersistedItemReferenceId(persistedItem),
                    field: "item_id",
                    message: `Line item ${index + 1} references the same existing order line twice.`,
                  },
                ]
              )
            }

            seenExistingIds.add(existingItemId)

            const existingItem = existingItemsById.get(existingItemId)

            if (!existingItem) {
              throw new OrderLineItemNotFoundError()
            }

            const progress = getExistingTrackedItemProgress(existingItem)
            const isSameIdentity = isSameOrderItemIdentity(
              existingItem,
              persistedItem
            )

            if (progress?.hasProgress && !isSameIdentity) {
              throw new OrderLineItemProgressLockedError(
                "Tracked line items with fulfillment progress cannot change their source item"
              )
            }

            if (
              progress?.hasProgress &&
              persistedItem.quantity < progress.minimumAllowedQuantity
            ) {
              throw new OrderLineItemProgressLockedError(
                "Tracked line item quantity cannot be reduced below recorded fulfillment progress"
              )
            }

            if (
              progress?.hasProgress &&
              existingItem.itemType === "product_bundle" &&
              persistedItem.quantity !== existingItem.quantity
            ) {
              throw new OrderLineItemProgressLockedError(
                "Bundle-backed line item quantity cannot change after fulfillment progress has been recorded"
              )
            }

            if (!isSameIdentity) {
              orderItemIdsToDelete.push(existingItem.id)
              itemsToCreate.push(persistedItem)

              pushReservationAdjustmentsFromComponents(
                reservationAdjustments,
                "release",
                getReservationComponentsForExistingOrderItem(existingItem),
                index,
                existingItem.id
              )
              pushReservationAdjustmentsFromComponents(
                reservationAdjustments,
                "reserve",
                getReservationComponentsForResolvedItem(resolvedItem),
                index
              )

              continue
            }

            itemsToUpdateInPlace.push({
              orderItemId: existingItem.id,
              item: persistedItem,
            })

            pushReservationDeltaAdjustments(
              reservationAdjustments,
              existingItem,
              resolvedItem,
              persistedItem.quantity,
              index
            )
          }

          for (const existingItem of existingOrderItems) {
            if (seenExistingIds.has(existingItem.id)) {
              continue
            }

            const progress = getExistingTrackedItemProgress(existingItem)

            if (progress?.hasProgress) {
              throw new OrderLineItemProgressLockedError(
                "Tracked line items with fulfillment progress cannot be removed from the order"
              )
            }

            orderItemIdsToDelete.push(existingItem.id)

            pushReservationAdjustmentsFromComponents(
              reservationAdjustments,
              "release",
              getReservationComponentsForExistingOrderItem(existingItem),
              parsedInput.line_items.length,
              existingItem.id
            )
          }

          if (existingInvoice) {
            await invoicesRepository.deleteInvoiceItems(existingInvoice.id)
          }

          for (const item of itemsToUpdateInPlace) {
            await ordersRepository.updateOrderItem(item.orderItemId, item.item)
          }

          if (orderItemIdsToDelete.length > 0) {
            await ordersRepository.deleteOrderItems(orderItemIdsToDelete)
          }

          await ordersRepository.createOrderItems(order.id, itemsToCreate)

          const refreshedOrder = await ordersRepository.findByIdWithRelations(
            order.id
          )

          if (!refreshedOrder) {
            throw new OrderNotFoundError()
          }

          const inventoryRepository = new InventoryRepository(db)
          const claimedReserveOrderItemIds = new Set<string>()

          for (const adjustment of reservationAdjustments) {
            if (adjustment.quantity === 0) {
              continue
            }

            if (adjustment.action === "reserve") {
              const targetOrderItem = refreshedOrder.items.find((item) => {
                if (
                  adjustment.orderItemId &&
                  item.id === adjustment.orderItemId
                ) {
                  return true
                }

                if (claimedReserveOrderItemIds.has(item.id)) {
                  return false
                }

                if (item.itemType !== adjustment.itemType) {
                  return false
                }

                if (adjustment.itemType === "cup") {
                  return item.cupId === adjustment.cupId
                }

                return item.lidId === adjustment.lidId
              })

              if (!targetOrderItem) {
                throw new Error(
                  "Failed to match updated order item to reservation request"
                )
              }

              claimedReserveOrderItemIds.add(targetOrderItem.id)

              await this.createInventoryService(db).reserveOrderItems(
                {
                  orderId: refreshedOrder.id,
                  createdByUserId: user.id,
                  items: [
                    {
                      orderItemId: targetOrderItem.id,
                      requestLineItemIndex: adjustment.requestLineItemIndex,
                      itemType: adjustment.itemType,
                      cupId: adjustment.cupId,
                      lidId: adjustment.lidId,
                      quantity: adjustment.quantity,
                    },
                  ],
                },
                { useExistingTransaction: true }
              )
              continue
            }

            await inventoryRepository.appendMovement({
              itemType: adjustment.itemType,
              cupId: adjustment.cupId,
              lidId: adjustment.lidId,
              movementType: "release_reservation",
              quantity: adjustment.quantity,
              orderId: refreshedOrder.id,
              orderItemId: adjustment.orderItemId!,
              note: "Released reservation after unpaid order edit",
              reference: refreshedOrder.id,
              createdByUserId: user.id,
            })
          }
        }

        await ordersRepository.updateOrderMetadata(order.id, {
          customerId: parsedInput.customer_id,
          notes: parsedInput.notes,
        })

        const updatedOrder = await ordersRepository.findByIdWithRelations(
          order.id
        )

        if (!updatedOrder) {
          throw new OrderNotFoundError()
        }

        if (hasStructuralChanges) {
          await syncInvoiceSnapshotForOrder(
            invoicesRepository,
            updatedOrder,
            user.id
          )
        }

        return toOrderDto(updatedOrder, user)
      }
    )
  }

  async updatePriorities(
    input: UpdateOrderPrioritiesInput,
    user: SafeUser
  ): Promise<OrderDto[]> {
    assertPermission(user, "orders.manage")

    const parsedInput = updateOrderPrioritiesSchema.parse(input)

    return this.ordersRepository.transaction(async ({ ordersRepository }) => {
      const matchingCount = await ordersRepository.countOrdersByIds(
        parsedInput.order_ids
      )

      if (matchingCount !== parsedInput.order_ids.length) {
        throw new OrderPriorityValidationError("Some orders no longer exist.")
      }

      const currentOrderIds = await ordersRepository.listAllOrderIdsByPriority()
      const requestedIds = new Set(parsedInput.order_ids)
      const reorderedIds = currentOrderIds.slice()

      let replacementIndex = 0

      for (let index = 0; index < reorderedIds.length; index += 1) {
        if (!requestedIds.has(reorderedIds[index] ?? "")) {
          continue
        }

        reorderedIds[index] =
          parsedInput.order_ids[replacementIndex] ?? reorderedIds[index]!
        replacementIndex += 1
      }

      await ordersRepository.replacePrioritiesByOrderIds(reorderedIds)

      const reorderedOrders = await ordersRepository.listWithRelations()
      return reorderedOrders.map((order) => toOrderDto(order, user))
    })
  }

  async archive(orderId: string, user: SafeUser): Promise<OrderDto> {
    assertPermission(user, "orders.manage")

    const order = await this.ordersRepository.findByIdWithRelations(orderId)

    if (!order) {
      throw new OrderNotFoundError()
    }

    if (order.archivedAt) {
      return toOrderDto(order, user)
    }

    if (order.status !== "canceled") {
      throw new OrderArchiveStatusError()
    }

    await this.ordersRepository.archiveOrder(order.id)

    const archivedOrder = await this.ordersRepository.findByIdWithRelations(
      order.id
    )

    if (!archivedOrder) {
      throw new OrderNotFoundError()
    }

    return toOrderDto(archivedOrder, user)
  }
}

function isRecoverableOrderListSchemaError(error: unknown): boolean {
  const code = getDbErrorCode(error)

  return code === "42P01" || code === "42703"
}

function getDbErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null
  }

  if (
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code
  }

  if ("cause" in error) {
    return getDbErrorCode((error as { cause?: unknown }).cause)
  }

  return null
}

function createOrderNumber(): string {
  const datePrefix = new Date().toISOString().slice(0, 10).replaceAll("-", "")

  return `IW-${datePrefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function toOrderItemInsert(item: ResolvedOrderLineItem) {
  if (item.itemType === "cup") {
    return {
      itemType: "cup" as const,
      cupId: item.cup.id,
      lidId: undefined,
      nonStockItemId: undefined,
      productBundleId: undefined,
      descriptionSnapshot: item.cup.sku,
      quantity: item.quantity,
      unitCostPrice: item.cup.costPrice,
      unitSellPrice: item.cup.defaultSellPrice,
      notes: item.notes,
    }
  }

  if (item.itemType === "lid") {
    return {
      itemType: "lid" as const,
      cupId: undefined,
      lidId: item.lid.id,
      nonStockItemId: undefined,
      productBundleId: undefined,
      descriptionSnapshot: buildLidDescriptionSnapshot(item.lid),
      quantity: item.quantity,
      unitCostPrice: item.lid.costPrice,
      unitSellPrice: item.lid.defaultSellPrice,
      notes: item.notes,
    }
  }

  if (item.itemType === "non_stock_item") {
    return {
      itemType: "non_stock_item" as const,
      cupId: undefined,
      lidId: undefined,
      nonStockItemId: item.nonStockItem.id,
      productBundleId: undefined,
      descriptionSnapshot: buildNonStockItemDescriptionSnapshot(
        item.nonStockItem
      ),
      quantity: item.quantity,
      unitCostPrice: item.nonStockItem.costPrice ?? "0",
      unitSellPrice: item.nonStockItem.defaultSellPrice,
      notes: item.notes,
    }
  }

  if (item.itemType === "product_bundle") {
    return {
      itemType: "product_bundle" as const,
      cupId: undefined,
      lidId: undefined,
      nonStockItemId: undefined,
      productBundleId: item.productBundle.id,
      descriptionSnapshot: buildProductBundleDescriptionSnapshot(
        item.productBundle
      ),
      quantity: item.quantity,
      unitCostPrice: item.unitCostPrice,
      unitSellPrice: item.unitSellPrice,
      notes: item.notes,
    }
  }

  return {
    itemType: "custom_charge" as const,
    cupId: undefined,
    lidId: undefined,
    nonStockItemId: undefined,
    productBundleId: undefined,
    descriptionSnapshot: item.descriptionSnapshot,
    quantity: item.quantity,
    unitCostPrice: item.unitCostPrice,
    unitSellPrice: item.unitSellPrice,
    notes: item.notes,
  }
}

function buildReservationRequestsForResolvedItems(
  order: OrderWithRelations,
  resolvedItems: ResolvedOrderLineItem[]
) {
  const claimedOrderItemIds = new Set<string>()
  const reservations: Array<{
    orderItemId: string
    requestLineItemIndex: number
    itemType: OrderInventoryItemType
    cupId?: string
    lidId?: string
    quantity: number
  }> = []

  for (const resolvedItem of resolvedItems) {
    const components = getReservationComponentsForResolvedItem(resolvedItem)

    if (components.length === 0) {
      continue
    }

    const createdOrderItem = findMatchingCreatedOrderItem(
      order.items,
      resolvedItem,
      claimedOrderItemIds
    )

    if (!createdOrderItem) {
      throw new Error(
        "Failed to match created order item to reservation request"
      )
    }

    claimedOrderItemIds.add(createdOrderItem.id)

    reservations.push(
      ...components.map((component) => ({
        orderItemId: createdOrderItem.id,
        requestLineItemIndex: resolvedItem.requestLineItemIndex,
        itemType: component.itemType,
        cupId: component.cupId,
        lidId: component.lidId,
        quantity: component.quantity,
      }))
    )
  }

  return reservations
}

function getReservationComponentsForResolvedItem(
  item: ResolvedOrderLineItem
): InventoryComponentReservation[] {
  if (item.itemType === "cup") {
    return [
      {
        itemType: "cup",
        cupId: item.cup.id,
        quantity: item.quantity,
      },
    ]
  }

  if (item.itemType === "lid") {
    return [
      {
        itemType: "lid",
        lidId: item.lid.id,
        quantity: item.quantity,
      },
    ]
  }

  if (item.itemType === "product_bundle") {
    return item.componentReservations
  }

  return []
}

function findMatchingCreatedOrderItem(
  orderItems: OrderWithRelations["items"],
  resolvedItem: ResolvedOrderLineItem,
  claimedOrderItemIds: Set<string>
) {
  return orderItems.find((orderItem) => {
    if (claimedOrderItemIds.has(orderItem.id)) {
      return false
    }

    if (resolvedItem.itemType === "cup") {
      return (
        orderItem.itemType === "cup" && orderItem.cupId === resolvedItem.cup.id
      )
    }

    if (resolvedItem.itemType === "lid") {
      return (
        orderItem.itemType === "lid" && orderItem.lidId === resolvedItem.lid.id
      )
    }

    if (resolvedItem.itemType === "product_bundle") {
      return (
        orderItem.itemType === "product_bundle" &&
        orderItem.productBundleId === resolvedItem.productBundle.id
      )
    }

    if (resolvedItem.itemType === "non_stock_item") {
      return (
        orderItem.itemType === "non_stock_item" &&
        orderItem.nonStockItemId === resolvedItem.nonStockItem.id
      )
    }

    return (
      orderItem.itemType === "custom_charge" &&
      orderItem.descriptionSnapshot === resolvedItem.descriptionSnapshot
    )
  })
}

function isSameOrderItemIdentity(
  existingItem: OrderItemWithProgressEvents,
  nextItem: ReturnType<typeof toOrderItemInsert>
): boolean {
  if (existingItem.itemType !== nextItem.itemType) {
    return false
  }

  if (existingItem.itemType === "cup") {
    return existingItem.cupId === nextItem.cupId
  }

  if (existingItem.itemType === "lid") {
    return existingItem.lidId === nextItem.lidId
  }

  if (existingItem.itemType === "non_stock_item") {
    return existingItem.nonStockItemId === nextItem.nonStockItemId
  }

  if (existingItem.itemType === "product_bundle") {
    return existingItem.productBundleId === nextItem.productBundleId
  }

  return existingItem.descriptionSnapshot === nextItem.descriptionSnapshot
}

function getExistingTrackedItemProgress(
  item: OrderItemWithProgressEvents
): ExistingTrackedItemProgress | null {
  if (!isTrackedOrderItemType(item.itemType)) {
    return null
  }

  const totals = calculateProgressTotals(
    item.itemType,
    item.quantity,
    item.progressEvents
  )
  const minimumAllowedQuantity =
    item.itemType === "cup" || item.itemType === "product_bundle"
      ? Math.max(
          totals.total_printed,
          totals.total_qa_passed,
          totals.total_packed,
          totals.total_ready_for_release,
          totals.total_released
        )
      : Math.max(
          totals.total_packed,
          totals.total_ready_for_release,
          totals.total_released
        )

  return {
    hasProgress:
      item.itemType === "cup" || item.itemType === "product_bundle"
        ? minimumAllowedQuantity > 0
        : minimumAllowedQuantity > 0,
    consumedQuantity:
      item.itemType === "lid"
        ? totals.total_released
        : Math.max(totals.total_printed, totals.total_released),
    minimumAllowedQuantity,
  }
}

function getTrackedReservationTarget(
  item: OrderItemWithProgressEvents,
  nextQuantity = item.quantity
): number {
  const progress = getExistingTrackedItemProgress(item)

  if (!progress) {
    return 0
  }

  return Math.max(nextQuantity - progress.consumedQuantity, 0)
}

function getPersistedItemReferenceId(
  item: ReturnType<typeof toOrderItemInsert>
): string | undefined {
  if (item.itemType === "cup") {
    return item.cupId
  }

  if (item.itemType === "lid") {
    return item.lidId
  }

  if (item.itemType === "non_stock_item") {
    return item.nonStockItemId
  }

  if (item.itemType === "product_bundle") {
    return item.productBundleId
  }

  return undefined
}

function getReservationComponentsForExistingOrderItem(
  item: OrderItemWithProgressEvents,
  nextQuantity = getTrackedReservationTarget(item)
): InventoryComponentReservation[] {
  if (nextQuantity <= 0) {
    return []
  }

  if (item.itemType === "cup") {
    return [
      {
        itemType: "cup",
        cupId: item.cupId ?? undefined,
        quantity: nextQuantity,
      },
    ]
  }

  if (item.itemType === "lid") {
    return [
      {
        itemType: "lid",
        lidId: item.lidId ?? undefined,
        quantity: nextQuantity,
      },
    ]
  }

  if (item.itemType !== "product_bundle") {
    return []
  }

  if (!item.productBundle) {
    throw new Error("Product bundle order item is missing its bundle relation")
  }

  return toProductBundleInventoryComponents(
    item.productBundle,
    nextQuantity
  ).map((component) =>
    component.itemType === "cup"
      ? {
          itemType: "cup" as const,
          cupId: component.itemId,
          quantity: component.quantity,
        }
      : {
          itemType: "lid" as const,
          lidId: component.itemId,
          quantity: component.quantity,
        }
  )
}

function pushReservationAdjustmentsFromComponents(
  adjustments: Array<{
    action: "reserve" | "release"
    itemType: "cup" | "lid"
    cupId?: string
    lidId?: string
    orderItemId?: string
    quantity: number
    requestLineItemIndex: number
  }>,
  action: "reserve" | "release",
  components: InventoryComponentReservation[],
  requestLineItemIndex: number,
  orderItemId?: string
): void {
  for (const component of components) {
    if (component.quantity <= 0) {
      continue
    }

    adjustments.push({
      action,
      itemType: component.itemType,
      cupId: component.cupId,
      lidId: component.lidId,
      orderItemId,
      quantity: component.quantity,
      requestLineItemIndex,
    })
  }
}

function pushReservationDeltaAdjustments(
  adjustments: Parameters<typeof pushReservationAdjustmentsFromComponents>[0],
  existingItem: OrderItemWithProgressEvents,
  resolvedItem: ResolvedOrderLineItem,
  nextQuantity: number,
  requestLineItemIndex: number
): void {
  const currentComponents =
    getReservationComponentsForExistingOrderItem(existingItem)
  const nextReservedSetQuantity = getTrackedReservationTarget(
    existingItem,
    nextQuantity
  )
  const nextComponents =
    resolvedItem.itemType === "product_bundle"
      ? getReservationComponentsForResolvedItem({
          ...resolvedItem,
          quantity: nextReservedSetQuantity,
          componentReservations:
            nextReservedSetQuantity > 0
              ? resolveProductBundleInventoryComponents({
                  lineItemIndex: resolvedItem.requestLineItemIndex,
                  productBundle: resolvedItem.productBundle,
                  quantity: nextReservedSetQuantity,
                })
              : [],
        })
      : getReservationComponentsForExistingOrderItem(
          existingItem,
          nextReservedSetQuantity
        )
  const currentByKey = toReservationComponentQuantityMap(currentComponents)
  const nextByKey = toReservationComponentQuantityMap(nextComponents)
  const allKeys = new Set([...currentByKey.keys(), ...nextByKey.keys()])

  for (const key of allKeys) {
    const currentQuantity = currentByKey.get(key)?.quantity ?? 0
    const nextComponent = nextByKey.get(key)
    const nextQuantityForComponent = nextComponent?.quantity ?? 0
    const delta = nextQuantityForComponent - currentQuantity

    if (delta === 0) {
      continue
    }

    const component = nextComponent ?? currentByKey.get(key)

    if (!component) {
      continue
    }

    pushReservationAdjustmentsFromComponents(
      adjustments,
      delta > 0 ? "reserve" : "release",
      [
        {
          itemType: component.itemType,
          cupId: component.cupId,
          lidId: component.lidId,
          quantity: Math.abs(delta),
        },
      ],
      requestLineItemIndex,
      existingItem.id
    )
  }
}

function toReservationComponentQuantityMap(
  components: InventoryComponentReservation[]
) {
  const byKey = new Map<string, InventoryComponentReservation>()

  for (const component of components) {
    const key =
      component.itemType === "cup"
        ? `cup:${component.cupId ?? ""}`
        : `lid:${component.lidId ?? ""}`
    const existing = byKey.get(key)

    byKey.set(key, {
      ...component,
      quantity: (existing?.quantity ?? 0) + component.quantity,
    })
  }

  return byKey
}

function getProductBundleProgressConsumptionComponents(
  item: OrderItemWithProgressEvents | OrderItemWithRelationsForProgress,
  stage: OrderLineItemProgressStage,
  setQuantity: number,
  componentItemType?: OrderProgressComponentItemType
): InventoryComponentReservation[] {
  if (item.itemType !== "product_bundle") {
    return []
  }

  if (!item.productBundle) {
    throw new Error("Product bundle order item is missing its bundle relation")
  }

  const components: InventoryComponentReservation[] = []

  if (
    componentItemType === "cup" &&
    stage === "printed" &&
    item.productBundle.cupId
  ) {
    components.push({
      itemType: "cup",
      cupId: item.productBundle.cupId,
      quantity: item.productBundle.cupQtyPerSet * setQuantity,
    })
  }

  if (
    componentItemType === "lid" &&
    stage === "released" &&
    item.productBundle.lidId
  ) {
    components.push({
      itemType: "lid",
      lidId: item.productBundle.lidId,
      quantity: item.productBundle.lidQtyPerSet * setQuantity,
    })
  }

  return components
}

type OrderItemWithRelationsForProgress = NonNullable<
  Awaited<ReturnType<OrdersRepository["findOrderItemWithOrder"]>>
>

function getCancellationReleaseComponents(
  item: OrderItemWithProgressEvents
): InventoryComponentReservation[] {
  if (!isTrackedOrderItemType(item.itemType)) {
    return []
  }

  const totals = calculateProgressTotals(
    item.itemType,
    item.quantity,
    item.progressEvents
  )

  if (item.itemType === "cup") {
    const quantity = Math.max(item.quantity - totals.total_printed, 0)
    return quantity > 0
      ? [{ itemType: "cup", cupId: item.cupId ?? undefined, quantity }]
      : []
  }

  if (item.itemType === "lid") {
    const quantity = Math.max(item.quantity - totals.total_released, 0)
    return quantity > 0
      ? [{ itemType: "lid", lidId: item.lidId ?? undefined, quantity }]
      : []
  }

  if (!item.productBundle) {
    throw new Error("Product bundle order item is missing its bundle relation")
  }

  const components: InventoryComponentReservation[] = []
  const unprintedSets = Math.max(item.quantity - totals.total_printed, 0)
  const unreleasedSets = Math.max(item.quantity - totals.total_released, 0)

  if (item.productBundle.cupId && unprintedSets > 0) {
    components.push({
      itemType: "cup",
      cupId: item.productBundle.cupId,
      quantity: item.productBundle.cupQtyPerSet * unprintedSets,
    })
  }

  if (item.productBundle.lidId && unreleasedSets > 0) {
    components.push({
      itemType: "lid",
      lidId: item.productBundle.lidId,
      quantity: item.productBundle.lidQtyPerSet * unreleasedSets,
    })
  }

  return components
}

function buildLidDescriptionSnapshot(lid: Lid): string {
  return lid.sku
}

function buildNonStockItemDescriptionSnapshot(
  nonStockItem: NonStockItem
): string {
  return nonStockItem.name
}

function buildProductBundleDescriptionSnapshot(
  productBundle: ProductBundle
): string {
  return productBundle.name
}

function isTrackedOrderItemType(
  itemType: string
): itemType is OrderTrackedLineItemType {
  return (
    itemType === "cup" || itemType === "lid" || itemType === "product_bundle"
  )
}

function resolveProgressComponentItemType(
  item: Pick<OrderItemWithRelationsForProgress, "itemType" | "productBundle">,
  requestedComponentItemType?: OrderProgressComponentItemType
): OrderProgressComponentItemType | undefined {
  if (item.itemType !== "product_bundle") {
    if (requestedComponentItemType) {
      throw new OrderProgressValidationError(
        "Progress component selection is only supported for product bundle line items"
      )
    }
    return undefined
  }

  if (!requestedComponentItemType) {
    throw new OrderProgressValidationError(
      "Product bundle progress requires component_item_type"
    )
  }

  if (!item.productBundle) {
    throw new Error("Product bundle order item is missing its bundle relation")
  }

  if (requestedComponentItemType === "cup" && !item.productBundle.cupId) {
    throw new OrderProgressValidationError(
      "Product bundle has no cup component"
    )
  }

  if (requestedComponentItemType === "lid" && !item.productBundle.lidId) {
    throw new OrderProgressValidationError(
      "Product bundle has no lid component"
    )
  }

  return requestedComponentItemType
}

function calculateProgressTotals(
  itemType: OrderTrackedLineItemType,
  orderedQuantity: number,
  events: Array<{ stage: OrderLineItemProgressStage; quantity: number }>,
  componentItemType?: OrderProgressComponentItemType
): ProgressTotalsDto {
  const totals = {
    line_item_status: "not_started" as OrderLineItemDerivedStatus,
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

  totals.remaining_balance = Math.max(
    orderedQuantity - totals.total_released,
    0
  )
  totals.line_item_status = deriveLineItemStatus(
    itemType,
    orderedQuantity,
    totals,
    componentItemType
  )

  return totals
}

export function validateProgressTotals(
  itemType: OrderTrackedLineItemType,
  orderedQuantity: number,
  totals: ProgressTotalsDto,
  componentItemType?: OrderProgressComponentItemType
) {
  if (itemType === "lid" || componentItemType === "lid") {
    for (const stage of lidProgressStages) {
      const total = totalForStage(totals, stage)

      if (total > orderedQuantity) {
        throw new OrderProgressValidationError(
          `${stage} total cannot exceed ordered quantity`
        )
      }
    }

    if (totals.total_printed > 0 || totals.total_qa_passed > 0) {
      throw new OrderProgressValidationError(
        "Lid line items only support packed, ready_for_release, and released events"
      )
    }

    if (totals.total_ready_for_release > totals.total_packed) {
      throw new OrderProgressValidationError(
        "Ready for release quantity cannot exceed packed quantity"
      )
    }

    if (totals.total_released > totals.total_ready_for_release) {
      throw new OrderProgressValidationError(
        "Released quantity cannot exceed ready for release quantity"
      )
    }

    return
  }

  if (itemType === "product_bundle" && componentItemType !== "cup") {
    throw new OrderProgressValidationError(
      "Product bundle progress requires a valid component item type"
    )
  }

  if (totals.total_qa_passed > totals.total_printed) {
    throw new OrderProgressValidationError(
      "QA passed quantity cannot exceed printed quantity"
    )
  }

  if (totals.total_packed > totals.total_qa_passed) {
    throw new OrderProgressValidationError(
      "Packed quantity cannot exceed QA passed quantity"
    )
  }

  if (totals.total_ready_for_release > totals.total_packed) {
    throw new OrderProgressValidationError(
      "Ready for release quantity cannot exceed packed quantity"
    )
  }

  if (totals.total_released > totals.total_ready_for_release) {
    throw new OrderProgressValidationError(
      "Released quantity cannot exceed ready for release quantity"
    )
  }
}

function totalForStage(
  totals: ProgressTotalsDto,
  stage: OrderLineItemProgressStage
): number {
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

function getAllowedProgressStages(
  itemType: OrderTrackedLineItemType
): readonly OrderLineItemProgressStage[] {
  return itemType === "lid" ? lidProgressStages : cupProgressStages
}

function deriveLineItemStatus(
  itemType: OrderTrackedLineItemType,
  orderedQuantity: number,
  totals: ProgressTotalsDto,
  componentItemType?: OrderProgressComponentItemType
): OrderLineItemDerivedStatus {
  if (orderedQuantity > 0 && totals.total_released >= orderedQuantity) {
    return "completed"
  }

  if (itemType === "cup" || componentItemType === "cup") {
    if (totals.total_released > 0) {
      return "released"
    }

    if (totals.total_ready_for_release > 0) {
      return "ready_for_release"
    }

    if (totals.total_packed > 0) {
      return "packed"
    }

    if (totals.total_qa_passed > 0) {
      return "qa_passed"
    }

    if (totals.total_printed > 0) {
      return "printed"
    }

    return "not_started"
  }

  if (totals.total_released > 0) {
    return "released"
  }

  if (totals.total_ready_for_release > 0) {
    return "ready_for_release"
  }

  if (totals.total_packed > 0) {
    return "packed"
  }

  return "not_started"
}

function deriveOrderStatus(
  currentStatus: OrderStatus,
  items: OrderItemWithProgressEvents[]
): OrderStatus {
  if (currentStatus === "canceled") {
    return "canceled"
  }

  const trackedItems = items.filter(
    (
      item
    ): item is OrderItemWithProgressEvents & {
      itemType: OrderTrackedLineItemType
    } => isTrackedOrderItemType(item.itemType)
  )

  if (trackedItems.length === 0) {
    return "completed"
  }

  let hasAnyProgress = false
  let hasAnyReleased = false
  let allLineItemsReleased = trackedItems.length > 0

  for (const item of trackedItems) {
    const totals = calculateProgressTotals(
      item.itemType,
      item.quantity,
      item.progressEvents
    )
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

function hasRecordedInvoicePayment(paidAmount: string): boolean {
  const normalized = paidAmount.trim()

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid invoice paid amount: ${paidAmount}`)
  }

  const [wholePart, decimalPart = ""] = normalized.split(".")
  const cents =
    BigInt(wholePart) * 100n + BigInt(`${decimalPart}00`.slice(0, 2))

  return cents > 0n
}
