import { Pool, type PoolConfig } from "pg"

import { loadDatabaseEnv } from "../config/env.js"

function buildPoolConfig(): PoolConfig {
  const env = loadDatabaseEnv()

  const ssl =
    env.databaseSslMode === "require"
      ? {
          rejectUnauthorized: false,
        }
      : undefined

  if (env.kind === "url") {
    return {
      connectionString: env.databaseUrl,
      ssl,
    }
  }

  return {
    host: env.host,
    port: env.port,
    user: env.user,
    password: env.password,
    database: env.database,
    ssl,
  }
}

let pool: Pool | null = null

export function createDatabasePool(overrides: Partial<PoolConfig> = {}): Pool {
  return new Pool({
    ...buildPoolConfig(),
    ...overrides,
  })
}

export function getDatabasePool(): Pool {
  if (!pool) {
    pool = createDatabasePool()
  }

  return pool
}

export async function resetDatabasePool(): Promise<void> {
  if (!pool) {
    return
  }

  const activePool = pool
  pool = null
  await activePool.end()
}
