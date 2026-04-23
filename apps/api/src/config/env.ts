const DATABASE_SSL_MODES = ["disable", "require"] as const

export type DatabaseSslMode = (typeof DATABASE_SSL_MODES)[number]

export interface ApiEnv {
  databaseUrl: string
  databaseSslMode: DatabaseSslMode
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function readDatabaseSslMode(): DatabaseSslMode {
  const value = (process.env.DATABASE_SSL_MODE ?? "disable").trim()

  if (DATABASE_SSL_MODES.includes(value as DatabaseSslMode)) {
    return value as DatabaseSslMode
  }

  throw new Error(
    `Invalid DATABASE_SSL_MODE: ${value}. Expected one of ${DATABASE_SSL_MODES.join(", ")}`,
  )
}

export function loadApiEnv(): ApiEnv {
  return {
    databaseUrl: readRequiredEnv("DATABASE_URL"),
    databaseSslMode: readDatabaseSslMode(),
  }
}
