import { spawn } from "node:child_process"

import { loadDatabaseEnv } from "../config/env.js"
import { getDatabasePool } from "./pool.js"

async function assertMigrationStateIsSafe(): Promise<void> {
  loadDatabaseEnv()

  const pool = getDatabasePool()
  const client = await pool.connect()

  try {
    const migrationTableResult = await client.query<{ exists: string | null }>(
      "select to_regclass('public.__drizzle_migrations') as exists",
    )
    const appTablesResult = await client.query<{ table_name: string }>(
      `
        select tablename as table_name
        from pg_tables
        where schemaname = 'public'
          and tablename <> '__drizzle_migrations'
        order by tablename asc
      `,
    )

    const hasMigrationTable = Boolean(migrationTableResult.rows[0]?.exists)
    const appTables = appTablesResult.rows.map((row) => row.table_name)

    if (!hasMigrationTable && appTables.length > 0) {
      throw new Error(
        [
          "Database is not in a deploy-safe migration state.",
          "App tables already exist but __drizzle_migrations does not.",
          "That usually means someone applied SQL manually or a prior migration crashed mid-run.",
          `Existing public tables: ${appTables.join(", ")}`,
          "Reset this database if it is disposable, or reconcile migration state before deploying.",
        ].join(" "),
      )
    }
  } finally {
    client.release()
    await pool.end()
  }
}

async function runDrizzleMigrate(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "drizzle-kit", "migrate"], {
      stdio: "inherit",
      env: process.env,
    })

    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          signal
            ? `drizzle-kit migrate terminated by signal ${signal}`
            : `drizzle-kit migrate exited with code ${code ?? "unknown"}`,
        ),
      )
    })
  })
}

async function main(): Promise<void> {
  await assertMigrationStateIsSafe()
  await runDrizzleMigrate()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
