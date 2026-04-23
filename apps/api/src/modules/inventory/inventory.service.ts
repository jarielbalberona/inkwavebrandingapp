import type { SafeUser } from "../auth/auth.schemas.js"
import { assertAdmin } from "../auth/authorization.js"
import { CupsRepository } from "../cups/cups.repository.js"
import { InventoryRepository } from "./inventory.repository.js"
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

export class InventoryCupNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Cup not found")
  }
}

export class InventoryCupInactiveError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Cannot append inventory movement for an inactive cup")
  }
}

export class InventoryBalanceCupNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Cup not found")
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

  constructor() {
    super("Insufficient available stock for reservation")
  }
}

export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly cupsRepository: CupsRepository,
  ) {}

  async appendMovement(input: AppendInventoryMovementInput) {
    const parsedInput = appendInventoryMovementSchema.parse(input)
    const cup = await this.cupsRepository.findById(parsedInput.cupId)

    if (!cup) {
      throw new InventoryCupNotFoundError()
    }

    if (!cup.isActive) {
      throw new InventoryCupInactiveError()
    }

    return this.inventoryRepository.appendMovement(parsedInput)
  }

  async recordStockIntake(input: StockIntakeRequest, user: SafeUser) {
    assertAdmin(user)

    return this.appendMovement({
      cupId: input.cupId,
      movementType: "stock_in",
      quantity: input.quantity,
      note: input.note,
      reference: input.reference,
      createdByUserId: user.id,
    })
  }

  async listBalances(query: InventoryBalanceQuery, user: SafeUser) {
    const parsedQuery = inventoryBalanceQuerySchema.parse(query)
    const balances = await this.inventoryRepository.listBalances({
      includeInactive: parsedQuery.include_inactive,
    })

    return balances.map((balance) => toInventoryBalanceDto(balance, user))
  }

  async getBalanceByCupId(cupId: string, user: SafeUser) {
    const balance = await this.inventoryRepository.getBalanceByCupId(cupId)

    if (!balance) {
      throw new InventoryBalanceCupNotFoundError()
    }

    return toInventoryBalanceDto(balance, user)
  }

  async listMovements(query: InventoryMovementsQuery, user: SafeUser) {
    const parsedQuery = inventoryMovementsQuerySchema.parse(query)
    const movements = await this.inventoryRepository.listMovements(parsedQuery)

    return movements.map((movement) => toInventoryMovementDto(movement, user))
  }

  async recordAdjustment(input: InventoryAdjustmentRequest, user: SafeUser) {
    assertAdmin(user)

    const parsedInput = inventoryAdjustmentRequestSchema.parse(input)

    if (parsedInput.movementType === "adjustment_out") {
      const balance = await this.inventoryRepository.getBalanceByCupId(parsedInput.cupId)

      if (!balance) {
        throw new InventoryBalanceCupNotFoundError()
      }

      if (balance.onHand < parsedInput.quantity) {
        throw new InventoryAdjustmentOutInsufficientStockError()
      }
    }

    return this.appendMovement({
      cupId: parsedInput.cupId,
      movementType: parsedInput.movementType,
      quantity: parsedInput.quantity,
      note: parsedInput.note,
      reference: parsedInput.reference,
      createdByUserId: user.id,
    })
  }

  async reserveOrderItems(input: ReserveOrderItemsInput) {
    const parsedInput = reserveOrderItemsSchema.parse(input)

    return this.inventoryRepository.transaction(async (repository) => {
      const totalsByCupId = new Map<string, number>()

      for (const item of parsedInput.items) {
        totalsByCupId.set(item.cupId, (totalsByCupId.get(item.cupId) ?? 0) + item.quantity)
      }

      for (const [cupId, quantity] of totalsByCupId) {
        const balance = await repository.getBalanceByCupId(cupId)

        if (!balance) {
          throw new InventoryBalanceCupNotFoundError()
        }

        if (!balance.cup.isActive) {
          throw new InventoryCupInactiveError()
        }

        if (balance.onHand - balance.reserved < quantity) {
          throw new InventoryReservationInsufficientStockError()
        }
      }

      const movements = []

      for (const item of parsedInput.items) {
        movements.push(
          await repository.appendMovement({
            cupId: item.cupId,
            movementType: "reserve",
            quantity: item.quantity,
            orderId: parsedInput.orderId,
            orderItemId: item.orderItemId,
            note: "Reserved for pending order",
            reference: parsedInput.orderId,
            createdByUserId: parsedInput.createdByUserId,
          }),
        )
      }

      return movements
    })
  }
}
