import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { Pool } from "pg"

const MIGRATIONS_DIR = join(process.cwd(), "drizzle")
const JOURNAL_FILE = join(MIGRATIONS_DIR, "meta", "_journal.json")

interface MigrationJournal {
  entries: Array<{
    idx: number
    tag: string
  }>
}

export async function applySqlMigrations(pool: Pool): Promise<void> {
  const journal = JSON.parse(
    await readFile(JOURNAL_FILE, "utf8"),
  ) as MigrationJournal
  const migrationFiles = journal.entries
    .slice()
    .sort((left, right) => left.idx - right.idx)
    .map((entry) => `${entry.tag}.sql`)

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
