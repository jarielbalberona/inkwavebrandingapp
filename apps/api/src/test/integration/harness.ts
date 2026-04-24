import request from "supertest"
import type { Response } from "supertest"
import { afterAll, beforeAll, beforeEach } from "vitest"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { createApiServer, type RuntimeApiEnv } from "../../app.js"
import { parseApiEnv } from "../../config/env.js"
import { resetDatabaseClient } from "../../db/client.js"
import { resetDatabasePool } from "../../db/pool.js"
import * as schema from "../../db/schema/index.js"
import { hashPassword } from "../../modules/users/passwords.js"
import { applySqlMigrations } from "./migrations.js"

interface IntegrationHarnessState {
  adminPool: Pool
  pool: Pool
  db: ReturnType<typeof drizzle<typeof schema>>
  databaseName: string
  env: RuntimeApiEnv
}

export const integrationAdmin = {
  email: "admin.integration@inkwave.test",
  password: "IntegrationAdminPassword123!",
} as const

export const integrationStaff = {
  email: "staff.integration@inkwave.test",
  password: "IntegrationStaffPassword123!",
} as const

let harnessStatePromise: Promise<IntegrationHarnessState> | null = null

export function useIntegrationHarness() {
  beforeAll(async () => {
    await getIntegrationHarness()
  }, 120_000)

  beforeEach(async () => {
    const harness = await getIntegrationHarness()
    await resetDatabase(harness.pool)
    await seedUsers(harness.db)
  })

  afterAll(async () => {
    if (!harnessStatePromise) {
      return
    }

    const harness = await harnessStatePromise
    harnessStatePromise = null
    await harness.pool.end()
    await resetDatabaseClient()
    await resetDatabasePool()
    await harness.adminPool.query(`DROP DATABASE IF EXISTS "${harness.databaseName}"`)
    await harness.adminPool.end()
  }, 120_000)
}

export async function getIntegrationRequest() {
  const harness = await getIntegrationHarness()

  return request(createApiServer(harness.env))
}

export async function loginAsAdmin() {
  const api = await getIntegrationRequest()

  return api.post("/auth/login").send(integrationAdmin) as Promise<Response>
}

export async function loginAsStaff() {
  const api = await getIntegrationRequest()

  return api.post("/auth/login").send(integrationStaff) as Promise<Response>
}

async function getIntegrationHarness(): Promise<IntegrationHarnessState> {
  if (!harnessStatePromise) {
    harnessStatePromise = createHarness()
  }

  return harnessStatePromise
}

async function createHarness(): Promise<IntegrationHarnessState> {
  const adminConnectionString =
    process.env.INTEGRATION_DATABASE_ADMIN_URL ??
    "postgresql://postgres:postgres@localhost:5433/postgres"
  const adminPool = new Pool({
    connectionString: adminConnectionString,
  })
  const databaseName = `ink_wave_integration_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`

  try {
    await adminPool.query("select 1")
  } catch (error) {
    await adminPool.end()
    throw new Error(
      "Integration PostgreSQL is not reachable. Run `docker compose -f docker-compose.dev.yml up -d postgres` or set INTEGRATION_DATABASE_ADMIN_URL.",
      { cause: error as Error },
    )
  }

  await adminPool.query(`CREATE DATABASE "${databaseName}"`)

  const connectionUrl = new URL(adminConnectionString)
  connectionUrl.pathname = `/${databaseName}`
  const connectionString = connectionUrl.toString()

  process.env.NODE_ENV = "test"
  process.env.PORT = "3000"
  process.env.DATABASE_URL = connectionString
  process.env.DATABASE_SSL_MODE = "disable"
  process.env.AUTH_SESSION_SECRET = "integration-test-auth-session-secret-123456"
  process.env.AUTH_SESSION_TTL_SECONDS = "28800"
  process.env.WEB_ORIGIN = "http://127.0.0.1:4173"
  process.env.SENTRY_DSN = ""
  process.env.SENTRY_TRACES_SAMPLE_RATE = "0"
  process.env.OPENAI_API_KEY = ""

  await resetDatabaseClient()
  await resetDatabasePool()

  const { createDatabasePool } = await import("../../db/pool.js")
  const pool = createDatabasePool()
  await applySqlMigrations(pool)

  const env = parseApiEnv(process.env)

  if (!env.authSessionSecret) {
    throw new Error("Integration harness requires AUTH_SESSION_SECRET")
  }

  return {
    adminPool,
    pool,
    db: drizzle(pool, { schema }),
    databaseName,
    env: {
      ...env,
      authSessionSecret: env.authSessionSecret,
    },
  }
}

async function resetDatabase(pool: Pool): Promise<void> {
  const result = await pool.query<{ tablename: string }>(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '__drizzle_migrations'
  `)

  if (result.rows.length === 0) {
    return
  }

  const tables = result.rows
    .map((row) => `"public"."${row.tablename}"`)
    .sort()
    .join(", ")

  await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`)
}

async function seedUsers(db: ReturnType<typeof drizzle<typeof schema>>) {
  const [adminPasswordHash, staffPasswordHash] = await Promise.all([
    hashPassword(integrationAdmin.password),
    hashPassword(integrationStaff.password),
  ])

  await db.insert(schema.users).values([
    {
      email: integrationAdmin.email,
      displayName: "Integration Admin",
      role: "admin",
      passwordHash: adminPasswordHash,
      isActive: true,
    },
    {
      email: integrationStaff.email,
      displayName: "Integration Staff",
      role: "staff",
      passwordHash: staffPasswordHash,
      isActive: true,
    },
  ])
}
