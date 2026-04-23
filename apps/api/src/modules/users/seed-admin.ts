import { getDatabaseClient } from "../../db/client.js"
import { hashPassword } from "./passwords.js"
import { bootstrapAdminSchema } from "./users.schemas.js"
import { UsersRepository } from "./users.repository.js"

function readSeedInput() {
  const result = bootstrapAdminSchema.safeParse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    displayName: process.env.ADMIN_DISPLAY_NAME,
  })

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")

    throw new Error(`Invalid admin seed environment: ${details}`)
  }

  return result.data
}

export async function seedAdminUser() {
  const input = readSeedInput()
  const repository = new UsersRepository(getDatabaseClient())
  const passwordHash = await hashPassword(input.password)

  return repository.upsertAdminUser({
    ...input,
    passwordHash,
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedAdminUser()
    .then((user) => {
      console.log(
        JSON.stringify(
          {
            ok: true,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              isActive: user.isActive,
            },
          },
          null,
          2,
        ),
      )
    })
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
}
