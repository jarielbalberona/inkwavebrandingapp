import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Pool } from "pg"

import { loadDatabaseEnv } from "../config/env.js"
import { createDatabasePool } from "./pool.js"

interface JournalEntry {
  idx: number
  when: number
  tag: string
  breakpoints: boolean
}

interface MigrationJournal {
  entries: JournalEntry[]
}

interface ParsedMigration {
  tag: string
  folderMillis: number
  hash: string
  statements: string[]
}

async function assertMigrationStateIsSafe(pool: Pool): Promise<void> {
  loadDatabaseEnv()

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
  }
}

async function readMigrations(): Promise<ParsedMigration[]> {
  const migrationsDir = join(process.cwd(), "drizzle")
  const journalPath = join(migrationsDir, "meta", "_journal.json")
  const journal = JSON.parse(
    await readFile(journalPath, "utf8"),
  ) as MigrationJournal

  return Promise.all(
    journal.entries.map(async (entry) => {
      const filePath = join(migrationsDir, `${entry.tag}.sql`)
      const sql = await readFile(filePath, "utf8")

      return {
        tag: entry.tag,
        folderMillis: entry.when,
        hash: createHash("sha256").update(sql).digest("hex"),
        statements: sql
          .split("--> statement-breakpoint")
          .map((statement) => statement.trim())
          .filter(Boolean),
      }
    }),
  )
}

function previewStatement(statement: string): string {
  return statement.replaceAll(/\s+/g, " ").trim().slice(0, 240)
}

async function runDeployMigrations(pool: Pool): Promise<void> {
  const migrations = await readMigrations()
  const client = await pool.connect()

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        "id" SERIAL PRIMARY KEY,
        "hash" text NOT NULL,
        "created_at" bigint
      )
    `)

    const lastMigrationResult = await client.query<{ created_at: string | number }>(`
      SELECT created_at
      FROM "drizzle"."__drizzle_migrations"
      ORDER BY created_at DESC
      LIMIT 1
    `)
    const lastCreatedAt = Number(lastMigrationResult.rows[0]?.created_at ?? 0)

    for (const migration of migrations) {
      if (lastCreatedAt >= migration.folderMillis) {
        continue
      }

      console.log(`Applying migration ${migration.tag}.sql`)
      await client.query("BEGIN")
      let failedStatement = ""

      try {
        for (const [index, statement] of migration.statements.entries()) {
          failedStatement = statement
          await client.query(statement)
          console.log(
            `Applied ${migration.tag}.sql statement ${index + 1}/${migration.statements.length}`,
          )
        }

        await client.query(
          `
            INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
            VALUES ($1, $2)
          `,
          [migration.hash, migration.folderMillis],
        )
        await client.query("COMMIT")
      } catch (error) {
        await client.query("ROLLBACK")

        const errorMessage =
          error instanceof Error ? error.message : "Unknown migration error"
        throw new Error(
          [
            `Migration failed in ${migration.tag}.sql.`,
            `Statement preview: ${previewStatement(failedStatement)}`,
            `Database error: ${errorMessage}`,
          ].join(" "),
          { cause: error instanceof Error ? error : undefined },
        )
      }
    }
  } finally {
    client.release()
  }
}

async function main(): Promise<void> {
  const pool = createDatabasePool()

  try {
    await assertMigrationStateIsSafe(pool)
    await runDeployMigrations(pool)
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
