import { config as loadDotenv } from "dotenv"
import { defineConfig } from "drizzle-kit"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Same .env as the API runtime (`src/config/env.ts`); drizzle-kit does not load it by default.
const configDir = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: join(configDir, ".env") })

const databaseUrl = process.env.DATABASE_URL ?? ""
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
