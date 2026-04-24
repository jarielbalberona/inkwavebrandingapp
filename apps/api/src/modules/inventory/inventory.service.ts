import type { SafeUser } from "../auth/auth.schemas.js"
import { assertPermission } from "../auth/authorization.js"
import { CupsRepository } from "../cups/cups.repository.js"
import { LidsRepository } from "../lids/lids.repository.js"
import {
  InventoryRepository,
  type InventoryBalanceSummary,
  type InventoryItemReference,
} from "./inventory.repository.js"
import {
  appendInventoryMovementSchema,
  inventoryAdjustmentRequestSchema,
  inventoryBalanceQuerySchema,
  inventoryMovementsQuerySchema,
  reserveOrderItemsSchema,
  type AppendInventoryMovementInput,
  type InventoryAdjustmentRequest,
  type InventoryBalanceQuery,
  type InventoryMovementsQuery,
  type ReserveOrderItemsInput,
  type StockIntakeRequest,
} from "./inventory.schemas.js"
import { toInventoryMovementDto } from "./inventory.movement-types.js"
import { toInventoryBalanceDto } from "./inventory.types.js"

export class InventoryItemNotFoundError extends Error {
  readonly statusCode = 404

  constructor(itemType: "cup" | "lid") {
    super(`${capitalizeInventoryItemType(itemType)} not found`)
  }
}

export class InventoryItemInactiveError extends Error {
  readonly statusCode = 409

  constructor(itemType: "cup" | "lid") {
    super(`Cannot append inventory movement for an inactive ${itemType}`)
  }
}

export class InventoryBalanceItemNotFoundError extends Error {
  readonly statusCode = 404

  constructor(itemType: "cup" | "lid") {
    super(`${capitalizeInventoryItemType(itemType)} not found`)
  }
}

export class InventoryAdjustmentOutInsufficientStockError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Adjustment out exceeds current on-hand stock")
  }
}

export class InventoryReservationInsufficientStockError extends Error {
  readonly statusCode = 409
  readonly details: InventoryReservationInsufficientStockDetail[]

  constructor(details: InventoryReservationInsufficientStockDetail[]) {
    super(
      details.length === 1
        ? details[0]!.message
        : "Some line items do not have enough available stock for reservation",
    )
    this.details = details
  }
}

export interface InventoryReservationInsufficientStockDetail {
  lineItemIndex: number
  itemType: "cup" | "lid"
  itemId: string
  field: "quantity"
  itemLabel: string
  requestedQuantity: number
  availableQuantity: number
  message: string
}

export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly cupsRepository: CupsRepository,
    private readonly lidsRepository: LidsRepository,
  ) {}

  async appendMovement(input: AppendInventoryMovementInput) {
    const parsedInput = appendInventoryMovementSchema.parse(input)
    await this.assertTrackedItemIsActive(this.toInventoryItemReference(parsedInput))

    return this.inventoryRepository.appendMovement(parsedInput)
  }

  async recordStockIntake(input: StockIntakeRequest, user: SafeUser) {
    assertPermission(user, "inventory.stock_intake")

    return this.appendMovement({
      itemType: input.itemType,
      cupId: input.cupId,
      lidId: input.lidId,
      movementType: "stock_in",
      quantity: input.quantity,
      note: input.note,
      reference: input.reference,
      createdByUserId: user.id,
    })
  }

  async listBalances(query: InventoryBalanceQuery, user: SafeUser) {
    assertPermission(user, "inventory.view")

    const parsedQuery = inventoryBalanceQuerySchema.parse(query)
    const balances = await this.inventoryRepository.listBalances({
      includeInactive: parsedQuery.include_inactive,
      itemType: parsedQuery.item_type,
    })

    return balances.map((balance) => toInventoryBalanceDto(balance, user))
  }

  async getBalanceByCupId(cupId: string, user: SafeUser) {
    assertPermission(user, "inventory.view")

    const balance = await this.inventoryRepository.getBalanceByCupId(cupId)

    if (!balance) {
      throw new InventoryBalanceItemNotFoundError("cup")
    }

    return toInventoryBalanceDto(balance, user)
  }

  async listMovements(query: InventoryMovementsQuery, user: SafeUser) {
    assertPermission(user, "inventory.view")

    const parsedQuery = inventoryMovementsQuerySchema.parse(query)
    const movements = await this.inventoryRepository.listMovements(parsedQuery)

    return movements.map((movement) => toInventoryMovementDto(movement, user))
  }

  async recordAdjustment(input: InventoryAdjustmentRequest, user: SafeUser) {
    assertPermission(user, "inventory.adjust")

    const parsedInput = inventoryAdjustmentRequestSchema.parse(input)
    const balance = await this.inventoryRepository.getBalanceByItem(
      this.toInventoryItemReference(parsedInput),
    )

    if (!balance) {
      throw new InventoryBalanceItemNotFoundError(parsedInput.itemType)
    }

    if (parsedInput.movementType === "adjustment_out" && balance.onHand < parsedInput.quantity) {
      throw new InventoryAdjustmentOutInsufficientStockError()
    }

    return this.appendMovement({
      itemType: parsedInput.itemType,
      cupId: parsedInput.cupId,
      lidId: parsedInput.lidId,
      movementType: parsedInput.movementType,
      quantity: parsedInput.quantity,
      note: parsedInput.note,
      reference: parsedInput.reference,
      createdByUserId: user.id,
    })
  }

  async reserveOrderItems(
    input: ReserveOrderItemsInput,
    options: { useExistingTransaction?: boolean } = {},
  ) {
    const parsedInput = reserveOrderItemsSchema.parse(input)

    if (options.useExistingTransaction) {
      return this.reserveOrderItemsWithRepository(parsedInput, this.inventoryRepository)
    }

    return this.inventoryRepository.transaction((repository) =>
      this.reserveOrderItemsWithRepository(parsedInput, repository),
    )
  }

  private async reserveOrderItemsWithRepository(
    input: ReserveOrderItemsInput,
    repository: InventoryRepository,
  ) {
    const totalsByItemKey = new Map<
      string,
      {
        reference: InventoryItemReference
        quantity: number
        requestedItems: Array<{
          lineItemIndex: number
          quantity: number
        }>
      }
    >()

    for (const item of input.items) {
      const reference = repository.toBalanceReference(item)
      const key = toInventoryItemKey(reference)
      const existing = totalsByItemKey.get(key)

      totalsByItemKey.set(key, {
        reference,
        quantity: (existing?.quantity ?? 0) + item.quantity,
        requestedItems: [
          ...(existing?.requestedItems ?? []),
          {
            lineItemIndex: item.requestLineItemIndex ?? 0,
            quantity: item.quantity,
          },
        ],
      })
    }

    const insufficientStockDetails: InventoryReservationInsufficientStockDetail[] = []

    for (const { reference, quantity, requestedItems } of totalsByItemKey.values()) {
      const balance = await repository.getBalanceByItem(reference)

      if (!balance) {
        throw new InventoryBalanceItemNotFoundError(reference.itemType)
      }

      await this.assertTrackedItemIsActive(reference)

      const availableQuantity = balance.onHand - balance.reserved

      if (availableQuantity < quantity) {
        const itemLabel = buildInventoryReservationItemLabel(balance)

        insufficientStockDetails.push(
          ...requestedItems.map(({ lineItemIndex, quantity: requestedQuantity }) => ({
            lineItemIndex,
            itemType: reference.itemType,
            itemId: reference.itemType === "cup" ? reference.cupId : reference.lidId,
            field: "quantity" as const,
            itemLabel,
            requestedQuantity,
            availableQuantity,
            message: `Line item ${lineItemIndex + 1} (${itemLabel}) requested ${requestedQuantity} but only ${availableQuantity} is available.`,
          })),
        )
      }
    }

    if (insufficientStockDetails.length > 0) {
      throw new InventoryReservationInsufficientStockError(insufficientStockDetails)
    }

    const movements = []

    for (const item of input.items) {
      movements.push(
        await repository.appendMovement({
          itemType: item.itemType,
          cupId: item.cupId,
          lidId: item.lidId,
          movementType: "reserve",
          quantity: item.quantity,
          orderId: input.orderId,
          orderItemId: item.orderItemId,
          note: "Reserved for pending order",
          reference: input.orderId,
          createdByUserId: input.createdByUserId,
        }),
      )
    }

    return movements
  }

  private async assertTrackedItemIsActive(reference: InventoryItemReference): Promise<void> {
    if (reference.itemType === "cup") {
      const cup = await this.cupsRepository.findById(reference.cupId)

      if (!cup) {
        throw new InventoryItemNotFoundError("cup")
      }

      if (!cup.isActive) {
        throw new InventoryItemInactiveError("cup")
      }

      return
    }

    const lid = await this.lidsRepository.findById(reference.lidId)

    if (!lid) {
      throw new InventoryItemNotFoundError("lid")
    }

    if (!lid.isActive) {
      throw new InventoryItemInactiveError("lid")
    }
  }

  private toInventoryItemReference(
    input: Pick<AppendInventoryMovementInput, "itemType" | "cupId" | "lidId">,
  ): InventoryItemReference {
    if (input.itemType === "cup") {
      return {
        itemType: "cup",
        cupId: input.cupId!,
      }
    }

    return {
      itemType: "lid",
      lidId: input.lidId!,
    }
  }
}

function buildInventoryReservationItemLabel(balance: InventoryBalanceSummary): string {
  if (balance.itemType === "cup") {
    return `cup ${balance.cup.sku}`
  }

  if (balance.lid.sku.trim()) {
    return `lid ${balance.lid.sku.trim()}`
  }

  return `lid ${balance.lid.brand} ${balance.lid.diameter} ${balance.lid.shape} ${balance.lid.color}`
}

function capitalizeInventoryItemType(itemType: "cup" | "lid"): string {
  return itemType.charAt(0).toUpperCase() + itemType.slice(1)
}

function toInventoryItemKey(reference: InventoryItemReference): string {
  return reference.itemType === "cup"
    ? `cup:${reference.cupId}`
    : `lid:${reference.lidId}`
}
