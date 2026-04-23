import { getDatabasePool } from "./pool.js"

async function main() {
  const pool = getDatabasePool()
  const client = await pool.connect()

  try {
    const result = await client.query<{
      current_database: string
      current_user: string
    }>("select current_database(), current_user")

    const row = result.rows[0]

    console.log(
      JSON.stringify(
        {
          ok: true,
          currentDatabase: row.current_database,
          currentUser: row.current_user,
        },
        null,
        2,
      ),
    )
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
