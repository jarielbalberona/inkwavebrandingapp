import { randomUUID } from "node:crypto"
import { once } from "node:events"

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { createApiServer, type RuntimeApiEnv } from "../../app.js"
import { parseApiEnv } from "../../config/env.js"
import { resetDatabaseClient } from "../../db/client.js"
import { resetDatabasePool } from "../../db/pool.js"
import * as schema from "../../db/schema/index.js"
import { logError, logInfo, serializeError } from "../../lib/logger.js"
import { CustomersRepository } from "../../modules/customers/customers.repository.js"
import { InvoicesRepository } from "../../modules/invoices/invoices.repository.js"
import { InvoicesService } from "../../modules/invoices/invoices.service.js"
import { InventoryRepository } from "../../modules/inventory/inventory.repository.js"
import { InventoryService } from "../../modules/inventory/inventory.service.js"
import { NonStockItemsRepository } from "../../modules/non-stock-items/non-stock-items.repository.js"
import { OrdersRepository } from "../../modules/orders/orders.repository.js"
import { OrdersService } from "../../modules/orders/orders.service.js"
import { CupsRepository } from "../../modules/cups/cups.repository.js"
import { LidsRepository } from "../../modules/lids/lids.repository.js"
import { hashPassword } from "../../modules/users/passwords.js"
import { applySqlMigrations } from "../integration/migrations.js"

const adminConnectionString =
  process.env.E2E_DATABASE_ADMIN_URL ??
  "postgresql://postgres:postgres@localhost:5433/postgres"
const e2eApiPort = process.env.PORT ?? "3100"
const e2eWebOrigin = process.env.WEB_ORIGIN ?? "http://127.0.0.1:4173"

const e2eAdmin = {
  email: "admin.e2e@inkwave.test",
  password: "E2eAdminPassword123!",
} as const

const e2eStaff = {
  email: "staff.e2e@inkwave.test",
  password: "E2eStaffPassword123!",
} as const

async function main() {
  const adminPool = new Pool({
    connectionString: adminConnectionString,
  })
  const databaseName = `ink_wave_e2e_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
  let pool: Pool | null = null
  let server: ReturnType<typeof createApiServer> | null = null

  try {
    await adminPool.query("select 1")
    await adminPool.query(`CREATE DATABASE "${databaseName}"`)

    const connectionUrl = new URL(adminConnectionString)
    connectionUrl.pathname = `/${databaseName}`
    const connectionString = connectionUrl.toString()

    process.env.NODE_ENV = "test"
    process.env.PORT = e2eApiPort
    process.env.DATABASE_URL = connectionString
    process.env.DATABASE_SSL_MODE = "disable"
    process.env.AUTH_SESSION_SECRET = "e2e-session-secret-123456789012345678901234567890"
    process.env.AUTH_SESSION_TTL_SECONDS = "28800"
    process.env.WEB_ORIGIN = e2eWebOrigin
    process.env.SENTRY_DSN = ""
    process.env.SENTRY_TRACES_SAMPLE_RATE = "0"
    process.env.OPENAI_API_KEY = ""

    await resetDatabaseClient()
    await resetDatabasePool()

    const { createDatabasePool } = await import("../../db/pool.js")
    pool = createDatabasePool()
    await applySqlMigrations(pool)

    const env = parseApiEnv(process.env)

    if (!env.authSessionSecret) {
      throw new Error("E2E server requires AUTH_SESSION_SECRET")
    }

    const runtimeEnv: RuntimeApiEnv = {
      ...env,
      authSessionSecret: env.authSessionSecret,
    }

    const db = drizzle(pool, { schema })
    const adminUser = await seedUsers(db)
    await seedSmokeData(db, adminUser)

    server = createApiServer(runtimeEnv)
    server.listen(runtimeEnv.port, "127.0.0.1")
    await once(server, "listening")

    logInfo({
      event: "e2e_server_ready",
      port: runtimeEnv.port,
      databaseName,
      adminEmail: e2eAdmin.email,
      seededInvoiceCustomer: "E2E Invoice Customer",
    })

    const shutdown = async (signal: string) => {
      logInfo({
        event: "e2e_server_shutdown",
        signal,
        databaseName,
      })

      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => {
            if (error) {
              reject(error)
              return
            }

            resolve()
          })
        })
      }

      if (pool) {
        await pool.end()
      }

      await resetDatabaseClient()
      await resetDatabasePool()
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`)
      await adminPool.end()
      process.exit(0)
    }

    process.on("SIGINT", () => {
      void shutdown("SIGINT")
    })
    process.on("SIGTERM", () => {
      void shutdown("SIGTERM")
    })
  } catch (error) {
    logError({
      event: "e2e_server_failed",
      databaseName,
      ...serializeError(error),
    })

    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => resolve())
      })
    }

    if (pool) {
      await pool.end()
    }

    await resetDatabaseClient()
    await resetDatabasePool()
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`)
    await adminPool.end()
    process.exit(1)
  }
}

async function seedUsers(
  db: ReturnType<typeof drizzle<typeof schema>>,
) {
  const [adminPasswordHash, staffPasswordHash] = await Promise.all([
    hashPassword(e2eAdmin.password),
    hashPassword(e2eStaff.password),
  ])

  const [adminUser] = await db
    .insert(schema.users)
    .values([
      {
        email: e2eAdmin.email,
        displayName: "E2E Admin",
        role: "admin",
        passwordHash: adminPasswordHash,
        isActive: true,
      },
      {
        email: e2eStaff.email,
        displayName: "E2E Staff",
        role: "staff",
        passwordHash: staffPasswordHash,
        isActive: true,
      },
    ])
    .returning()

  if (!adminUser) {
    throw new Error("Failed to seed E2E admin user")
  }

  return {
    id: adminUser.id,
    email: adminUser.email,
    displayName: adminUser.displayName,
    role: "admin",
  } as const
}

async function seedSmokeData(
  db: ReturnType<typeof drizzle<typeof schema>>,
  adminUser: {
    id: string
    email: string
    displayName: string | null
    role: "admin"
  },
) {
  const [customer] = await db
    .insert(schema.customers)
    .values({
      customerCode: "E2E-INVOICE",
      businessName: "E2E Invoice Customer",
      contactPerson: "E2E Contact",
      contactNumber: "09179990000",
      email: "invoice.customer@inkwave.test",
      address: "E2E Seed Address",
      notes: "Seeded for Playwright smoke",
      isActive: true,
    })
    .returning()

  const [nonStockItem] = await db
    .insert(schema.nonStockItems)
    .values({
      name: `E2E Layout Fee ${randomUUID().slice(0, 6)}`,
      description: "Seeded invoice line item",
      costPrice: "3.00",
      defaultSellPrice: "12.50",
      isActive: true,
    })
    .returning()

  if (!customer || !nonStockItem) {
    throw new Error("Failed to seed E2E customer or non-stock item")
  }

  const ordersService = new OrdersService(
    new OrdersRepository(db),
    new CustomersRepository(db),
    new CupsRepository(db),
    new LidsRepository(db),
    new NonStockItemsRepository(db),
    (transactionDb) =>
      new InventoryService(
        new InventoryRepository(transactionDb),
        new CupsRepository(transactionDb),
        new LidsRepository(transactionDb),
      ),
  )

  const invoicesService = new InvoicesService(
    new InvoicesRepository(db),
    new OrdersRepository(db),
  )

  const order = await ordersService.create(
    {
      customer_id: customer.id,
      notes: "Seeded for Playwright invoice smoke",
      line_items: [
        {
          item_type: "non_stock_item",
          non_stock_item_id: nonStockItem.id,
          quantity: 1,
        },
      ],
    },
    adminUser,
  )

  await invoicesService.generateForOrder(order.id, adminUser)
}

void main()
