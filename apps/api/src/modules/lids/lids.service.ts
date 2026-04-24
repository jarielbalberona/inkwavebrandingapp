import type { SafeUser } from "../auth/auth.schemas.js"
import { assertAdmin, AuthorizationError } from "../auth/authorization.js"
import { LidsRepository } from "./lids.repository.js"
import type { CreateLidInput, LidListQuery, UpdateLidInput } from "./lids.schemas.js"
import { toLidDto, type LidDto } from "./lids.types.js"
import { generateLidSku, wouldRegenerateLidSku } from "../../lib/master-data/sku.js"

export class LidNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Lid not found")
  }
}

export class DuplicateLidError extends Error {
  readonly statusCode = 409

  constructor() {
    super("Lid SKU already exists")
  }
}

export class LidIdentityLockedError extends Error {
  readonly statusCode = 409

  constructor() {
    super("This lid is already used in historical records. Create a new lid instead of changing SKU-driving fields.")
  }
}

export class LidPersistenceValidationError extends Error {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
  }
}

export class LidsService {
  constructor(private readonly lidsRepository: LidsRepository) {}

  async list(query: LidListQuery, user: SafeUser): Promise<LidDto[]> {
    const lids = await this.lidsRepository.list({
      includeInactive: query.include_inactive,
    })

    return lids.map((lid) => toLidDto(lid, user))
  }

  async getById(id: string, user: SafeUser): Promise<LidDto> {
    const lid = await this.lidsRepository.findById(id)

    if (!lid) {
      throw new LidNotFoundError()
    }

    return toLidDto(lid, user)
  }

  async create(input: CreateLidInput, user: SafeUser): Promise<LidDto> {
    assertAdmin(user)

    try {
      const sku = generateLidSku(input)

      return toLidDto(
        await this.lidsRepository.create({
          ...input,
          sku,
        }),
        user,
      )
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateLidError()
      }

      const persistenceValidationError = toLidPersistenceValidationError(error)
      if (persistenceValidationError) {
        throw persistenceValidationError
      }

      throw error
    }
  }

  async update(id: string, input: UpdateLidInput, user: SafeUser): Promise<LidDto> {
    assertAdmin(user)

    try {
      const existingLid = await this.lidsRepository.findById(id)

      if (!existingLid) {
        throw new LidNotFoundError()
      }

      const nextSku = generateLidSku({
        diameter: input.diameter ?? existingLid.diameter,
        brand: input.brand ?? existingLid.brand,
        shape: input.shape ?? existingLid.shape,
        color: input.color ?? existingLid.color,
      })
      const regeneratesSku = wouldRegenerateLidSku(existingLid, input)

      if (regeneratesSku && (await this.lidsRepository.hasHistoricalUsage(id))) {
        throw new LidIdentityLockedError()
      }

      const lid = await this.lidsRepository.update(id, {
        ...input,
        sku: nextSku,
      })

      if (!lid) {
        throw new LidNotFoundError()
      }

      return toLidDto(lid, user)
    } catch (error) {
      if (
        error instanceof AuthorizationError ||
        error instanceof LidIdentityLockedError ||
        error instanceof LidNotFoundError
      ) {
        throw error
      }

      if (isUniqueViolation(error)) {
        throw new DuplicateLidError()
      }

      const persistenceValidationError = toLidPersistenceValidationError(error)
      if (persistenceValidationError) {
        throw persistenceValidationError
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

function toLidPersistenceValidationError(error: unknown): LidPersistenceValidationError | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null
  }

  const code = (error as { code?: unknown }).code
  const detail =
    "detail" in error && typeof (error as { detail?: unknown }).detail === "string"
      ? (error as { detail: string }).detail
      : null
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : null

  if (code === "23514" || code === "23502" || code === "22P02") {
    return new LidPersistenceValidationError(
      detail || message || "Lid data failed database validation.",
    )
  }

  return null
}
