import { drizzle } from "drizzle-orm/node-postgres"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import { getDatabasePool } from "./pool.js"
import * as schema from "./schema/index.js"

export type DatabaseClient = NodePgDatabase<typeof schema>

export function createDatabaseClient() {
  return drizzle(getDatabasePool(), {
    schema,
  })
}

let databaseClient: DatabaseClient | null = null

export function getDatabaseClient(): DatabaseClient {
  if (!databaseClient) {
    databaseClient = createDatabaseClient()
  }

  return databaseClient
}
