import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import type { Pool } from "pg"

const MIGRATIONS_DIR = join(process.cwd(), "drizzle")

export async function applySqlMigrations(pool: Pool): Promise<void> {
  const entries = await readdir(MIGRATIONS_DIR)
  const migrationFiles = entries
    .filter((entry) => entry.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right))

  for (const file of migrationFiles) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8")
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean)

    for (const statement of statements) {
      await pool.query(statement)
    }
  }
}
