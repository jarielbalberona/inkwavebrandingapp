import type { SafeUser } from "../auth/auth.schemas.js"
import { listPermissionDefinitions } from "../auth/permissions.js"
import { assertPermission } from "../auth/authorization.js"
import { hashPassword } from "./passwords.js"
import type { CreateUserInput, UpdateUserPermissionsInput } from "./users.schemas.js"
import { UsersRepository } from "./users.repository.js"
import { toUserDto, type UserDto, type UsersListDto } from "./users.types.js"

export class DuplicateUserEmailError extends Error {
  readonly statusCode = 409

  constructor() {
    super("User email already exists")
  }
}

export class UserNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super("User not found")
  }
}

export class UserPermissionAssignmentError extends Error {
  readonly statusCode = 409

  constructor(message: string) {
    super(message)
  }
}

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async list(user: SafeUser): Promise<UsersListDto> {
    assertPermission(user, "users.manage")

    const users = await this.usersRepository.list()
    return {
      users: users.map((entry) => toUserDto(entry)),
      permission_catalog: listPermissionDefinitions(),
    }
  }

  async create(input: CreateUserInput, user: SafeUser): Promise<UserDto> {
    assertPermission(user, "users.manage")

    try {
      const passwordHash = await hashPassword(input.password)
      const createdUser = await this.usersRepository.createUser({
        ...input,
        passwordHash,
      })

      return toUserDto(createdUser)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateUserEmailError()
      }

      throw error
    }
  }

  async updatePermissions(
    userId: string,
    input: UpdateUserPermissionsInput,
    user: SafeUser,
  ): Promise<UserDto> {
    assertPermission(user, "users.manage")

    const existingUser = await this.usersRepository.findById(userId)

    if (!existingUser) {
      throw new UserNotFoundError()
    }

    if (existingUser.role === "admin") {
      throw new UserPermissionAssignmentError("Admin users already receive the full permission set")
    }

    const updatedUser = await this.usersRepository.updatePermissions(userId, input)

    if (!updatedUser) {
      throw new UserNotFoundError()
    }

    return toUserDto(updatedUser)
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
