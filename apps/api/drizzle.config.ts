import { config as loadDotenv } from "dotenv"
import { defineConfig } from "drizzle-kit"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Same .env as the API runtime (`src/config/env.ts`); drizzle-kit does not load it by default.
const configDir = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: join(configDir, ".env") })

const require = createRequire(import.meta.url)
const parsePgConnectionString = require("pg-connection-string") as (
  connectionString: string,
) => Record<string, unknown>

function resolveDrizzleDatabaseUrl(): string {
  const host = process.env.DATABASE_HOST?.trim()
  const user = process.env.DATABASE_USER?.trim()
  const passwordRaw = process.env.DATABASE_PASSWORD?.replaceAll(/\r|\n/g, "").trim()
  const database = process.env.DATABASE_NAME?.trim()
  const portRaw = process.env.DATABASE_PORT
  const port =
    portRaw !== undefined && portRaw !== null && String(portRaw).trim() !== ""
      ? Number(portRaw)
      : 5432

  if (host && user && passwordRaw && database && Number.isFinite(port)) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(passwordRaw)}@${host}:${port}/${encodeURIComponent(database)}`
  }

  let url = process.env.DATABASE_URL?.trim().replaceAll(/\r|\n/g, "") ?? ""
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim()
  }

  if (url) {
    try {
      parsePgConnectionString(url)
      return url
    } catch {
      return ""
    }
  }

  return ""
}

const databaseUrl = resolveDrizzleDatabaseUrl()
const requireSsl = process.env.DATABASE_SSL_MODE === "require"

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ssl: requireSsl ? { rejectUnauthorized: false } : undefined,
  },
  strict: true,
  verbose: true,
})
