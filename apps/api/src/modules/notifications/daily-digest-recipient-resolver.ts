import type { User } from "../../db/schema/index.js"

export interface DailyDigestRecipient {
  email: string
  name?: string
}

export interface DailyDigestRecipientUserSource {
  listActiveAdmins(): Promise<Pick<User, "email" | "displayName" | "role" | "isActive">[]>
}

export class DailyDigestRecipientResolver {
  constructor(private readonly userSource: DailyDigestRecipientUserSource) {}

  async resolve(): Promise<DailyDigestRecipient[]> {
    const admins = await this.userSource.listActiveAdmins()
    const deduped = new Map<string, DailyDigestRecipient>()

    for (const admin of admins) {
      if (!admin.isActive || admin.role !== "admin") {
        continue
      }

      const normalizedEmail = admin.email.trim().toLowerCase()

      if (!normalizedEmail || deduped.has(normalizedEmail)) {
        continue
      }

      const normalizedName = admin.displayName?.trim()

      deduped.set(
        normalizedEmail,
        normalizedName
          ? {
              email: normalizedEmail,
              name: normalizedName,
            }
          : {
              email: normalizedEmail,
            },
      )
    }

    return [...deduped.values()].sort((left, right) => left.email.localeCompare(right.email))
  }
}
