import { CupsRepository } from "../cups/cups.repository.js"
import { InventoryRepository } from "./inventory.repository.js"
import {
  appendInventoryMovementSchema,
  type AppendInventoryMovementInput,
} from "./inventory.schemas.js"

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
}
