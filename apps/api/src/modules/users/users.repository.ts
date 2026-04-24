import { and, desc, eq } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { users, type User } from "../../db/schema/index.js"
import type {
  BootstrapAdminInput,
  CreateUserInput,
  UpdateStaffUserInput,
} from "./users.schemas.js"

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

  async findById(id: string): Promise<User | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    return rows[0]
  }

  async list(): Promise<User[]> {
    return this.db.select().from(users).orderBy(desc(users.createdAt), desc(users.email))
  }

  async listActiveAdmins(): Promise<User[]> {
    return this.db
      .select()
      .from(users)
      .where(and(eq(users.isActive, true), eq(users.role, "admin")))
      .orderBy(desc(users.createdAt), desc(users.email))
  }

  async createUser(input: CreateUserInput & { passwordHash: string }): Promise<User> {
    const rows = await this.db
      .insert(users)
      .values({
        email: input.email,
        displayName: input.displayName,
        role: input.role,
        permissions: input.permissions,
        passwordHash: input.passwordHash,
        isActive: true,
      })
      .returning()

    const user = rows[0]

    if (!user) {
      throw new Error("Failed to create user")
    }

    return user
  }

  async updateStaffUser(id: string, input: UpdateStaffUserInput): Promise<User | undefined> {
    const rows = await this.db
      .update(users)
      .set({
        displayName: input.displayName?.trim() ? input.displayName.trim() : null,
        permissions: input.permissions,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning()

    return rows[0]
  }

  async archiveUser(id: string): Promise<User | undefined> {
    const rows = await this.db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning()

    return rows[0]
  }

  async upsertAdminUser(input: BootstrapAdminInput & { passwordHash: string }): Promise<User> {
    const rows = await this.db
      .insert(users)
      .values({
        email: input.email,
        displayName: input.displayName,
        role: "admin",
        permissions: [],
        passwordHash: input.passwordHash,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          displayName: input.displayName,
          role: "admin",
          permissions: [],
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
