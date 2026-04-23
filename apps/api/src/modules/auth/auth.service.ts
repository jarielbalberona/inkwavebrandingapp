import type { User } from "../../db/schema/index.js"
import { verifyPassword } from "../users/passwords.js"
import { UsersRepository } from "../users/users.repository.js"
import type { LoginRequest, SafeUser } from "./auth.schemas.js"

export class AuthenticationError extends Error {
  constructor() {
    super("Invalid email or password")
  }
}

export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async authenticate(input: LoginRequest): Promise<SafeUser> {
    const user = await this.usersRepository.findByEmail(input.email)

    if (!user || !user.isActive) {
      throw new AuthenticationError()
    }

    const isValidPassword = await verifyPassword(user.passwordHash, input.password)

    if (!isValidPassword) {
      throw new AuthenticationError()
    }

    return toSafeUser(user)
  }

  async getCurrentUser(userId: string): Promise<SafeUser | null> {
    const user = await this.usersRepository.findById(userId)

    if (!user || !user.isActive) {
      return null
    }

    return toSafeUser(user)
  }
}

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  }
}
