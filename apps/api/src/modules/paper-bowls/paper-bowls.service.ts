import type { SafeUser } from "../auth/auth.schemas.js"
import { assertPermission } from "../auth/authorization.js"
import { generatePaperBowlSku } from "./paper-bowls.contract.js"
import { PaperBowlsRepository } from "./paper-bowls.repository.js"
import type { CreatePaperBowlInput, PaperBowlListQuery, UpdatePaperBowlInput } from "./paper-bowls.schemas.js"
import { toPaperBowlDto } from "./paper-bowls.types.js"

export class PaperBowlNotFoundError extends Error {
  readonly statusCode = 404
  constructor() {
    super("Paper bowl not found")
  }
}

export class DuplicatePaperBowlError extends Error {
  readonly statusCode = 409
  constructor() {
    super("A paper bowl with this size and color already exists")
  }
}

export class PaperBowlsService {
  constructor(private readonly repository: PaperBowlsRepository) {}

  async list(query: PaperBowlListQuery, user: SafeUser) {
    assertPermission(user, "cups.view")
    return (await this.repository.list(query.include_inactive)).map((bowl) =>
      toPaperBowlDto(bowl, user),
    )
  }

  async create(input: CreatePaperBowlInput, user: SafeUser) {
    assertPermission(user, "cups.manage")
    try {
      return toPaperBowlDto(
        await this.repository.create({ ...input, sku: generatePaperBowlSku(input) }),
        user,
      )
    } catch (error) {
      if (getDbErrorCode(error) === "23505") throw new DuplicatePaperBowlError()
      throw error
    }
  }

  async update(id: string, input: UpdatePaperBowlInput, user: SafeUser) {
    assertPermission(user, "cups.manage")
    const existing = await this.repository.findById(id)
    if (!existing) throw new PaperBowlNotFoundError()

    const size = input.size ?? existing.size
    const color = input.color ?? existing.color
    try {
      const bowl = await this.repository.update(id, {
        ...input,
        sku: generatePaperBowlSku({ size, color }),
      })
      if (!bowl) throw new PaperBowlNotFoundError()
      return toPaperBowlDto(bowl, user)
    } catch (error) {
      if (getDbErrorCode(error) === "23505") throw new DuplicatePaperBowlError()
      throw error
    }
  }
}

function getDbErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null
  if ("code" in error && typeof error.code === "string") return error.code
  return "cause" in error ? getDbErrorCode(error.cause) : null
}
