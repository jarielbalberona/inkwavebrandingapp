import type { SafeUser } from "../auth/auth.schemas.js"
import { assertAdmin, AuthorizationError } from "../auth/authorization.js"
import { LidsRepository } from "./lids.repository.js"
import type { CreateLidInput, LidListQuery, UpdateLidInput } from "./lids.schemas.js"
import { toLidDto, type LidDto } from "./lids.types.js"

export class LidNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("Lid not found")
  }
}

export class DuplicateLidError extends Error {
  readonly statusCode = 409

  constructor() {
    super("An identical lid already exists")
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
      return toLidDto(await this.lidsRepository.create(input), user)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateLidError()
      }

      throw error
    }
  }

  async update(id: string, input: UpdateLidInput, user: SafeUser): Promise<LidDto> {
    assertAdmin(user)

    try {
      const lid = await this.lidsRepository.update(id, input)

      if (!lid) {
        throw new LidNotFoundError()
      }

      return toLidDto(lid, user)
    } catch (error) {
      if (error instanceof AuthorizationError || error instanceof LidNotFoundError) {
        throw error
      }

      if (isUniqueViolation(error)) {
        throw new DuplicateLidError()
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
