import type { SafeUser } from "../auth/auth.schemas.js"
import { assertAdmin, AuthorizationError } from "../auth/authorization.js"
import { CupsRepository } from "./cups.repository.js"
import type { CupListQuery, CreateCupInput, UpdateCupInput } from "./cups.schemas.js"
import { toCupDto, type CupDto } from "./cups.types.js"

export class CupNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Cup not found")
  }
}

export class DuplicateCupSkuError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Cup SKU already exists")
  }
}

export class CupsService {
  constructor(private readonly cupsRepository: CupsRepository) {}

  async list(query: CupListQuery, user: SafeUser): Promise<CupDto[]> {
    const cups = query.sku
      ? await this.cupsRepository.listBySkuSearch(query.sku, {
          includeInactive: query.include_inactive,
        })
      : await this.cupsRepository.list({
          includeInactive: query.include_inactive,
        })

    return cups.map((cup) => toCupDto(cup, user))
  }

  async getById(id: string, user: SafeUser): Promise<CupDto> {
    const cup = await this.cupsRepository.findById(id)

    if (!cup) {
      throw new CupNotFoundError()
    }

    return toCupDto(cup, user)
  }

  async getBySku(sku: string, user: SafeUser): Promise<CupDto> {
    const cup = await this.cupsRepository.findBySku(sku)

    if (!cup) {
      throw new CupNotFoundError()
    }

    return toCupDto(cup, user)
  }

  async create(input: CreateCupInput, user: SafeUser): Promise<CupDto> {
    assertAdmin(user)

    try {
      return toCupDto(await this.cupsRepository.create(input), user)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateCupSkuError()
      }

      throw error
    }
  }

  async update(id: string, input: UpdateCupInput, user: SafeUser): Promise<CupDto> {
    assertAdmin(user)

    try {
      const cup = await this.cupsRepository.update(id, input)

      if (!cup) {
        throw new CupNotFoundError()
      }

      return toCupDto(cup, user)
    } catch (error) {
      if (error instanceof AuthorizationError || error instanceof CupNotFoundError) {
        throw error
      }

      if (isUniqueViolation(error)) {
        throw new DuplicateCupSkuError()
      }

      throw error
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505",
  )
}
