import { eq } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { users, type User } from "../../db/schema/index.js"
import type { BootstrapAdminInput } from "./users.schemas.js"

export class UsersRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findByEmail(email: string): Promise<User | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    return rows[0]
  }

  async upsertAdminUser(input: BootstrapAdminInput & { passwordHash: string }): Promise<User> {
    const rows = await this.db
      .insert(users)
      .values({
        email: input.email,
        displayName: input.displayName,
        role: "admin",
        passwordHash: input.passwordHash,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          displayName: input.displayName,
          role: "admin",
          passwordHash: input.passwordHash,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning()

    const user = rows[0]

    if (!user) {
      throw new Error("Failed to upsert admin user")
    }

    return user
  }
}
