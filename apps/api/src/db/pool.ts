import { Pool, type PoolConfig } from "pg"

import { loadDatabaseEnv } from "../config/env.js"

function buildPoolConfig(): PoolConfig {
  const env = loadDatabaseEnv()

  return {
    connectionString: env.databaseUrl,
    ssl:
      env.databaseSslMode === "require"
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
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
