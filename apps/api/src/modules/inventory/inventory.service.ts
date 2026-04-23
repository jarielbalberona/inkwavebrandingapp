import type { SafeUser } from "../auth/auth.schemas.js"
import { assertAdmin } from "../auth/authorization.js"
import { CupsRepository } from "../cups/cups.repository.js"
import { InventoryRepository } from "./inventory.repository.js"
import {
  appendInventoryMovementSchema,
  inventoryBalanceQuerySchema,
  type AppendInventoryMovementInput,
  type InventoryBalanceQuery,
  type StockIntakeRequest,
} from "./inventory.schemas.js"
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
}
