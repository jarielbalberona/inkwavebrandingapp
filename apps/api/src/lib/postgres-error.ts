/**
 * Normalize PostgreSQL / node-pg error metadata from wrapped errors (Drizzle, custom joins).
 * Parsers fill gaps when the driver omits `column` / `table` but the text is in `message`.
 */

function walkErrorChain(error: unknown): unknown[] {
  const chain: unknown[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  for (let depth = 0; depth < 20 && current; depth += 1) {
    if (typeof current !== "object" || current === null) {
      break
    }
    if (seen.has(current)) {
      break
    }
    seen.add(current)
    chain.push(current)
    current = (current as { cause?: unknown }).cause
  }

  return chain
}

const PG_CODE = /^\d{5}$/

export interface CollectedPostgresError {
  code: string
  column?: string
  table?: string
  detail?: string
  constraint?: string
  /** Driver / Postgres text (Drizzle often surfaces the useful line here) */
  driverMessage: string
}

function isPgNode(n: unknown): n is Record<string, unknown> {
  if (!n || typeof n !== "object") {
    return false
  }
  const c = (n as { code?: unknown }).code
  return typeof c === "string" && PG_CODE.test(c)
}

/**
 * Picks the innermost / best Postgres metadata from a chain of Error causes.
 */
export function collectPostgresErrorMetadata(error: unknown): CollectedPostgresError | null {
  const chain = walkErrorChain(error)
  if (chain.length === 0) {
    return null
  }

  const pgNodes = chain.filter(isPgNode)
  if (pgNodes.length === 0) {
    return null
  }

  const pickFirstString = (getter: (n: Record<string, unknown>) => string | undefined) => {
    for (const n of pgNodes) {
      const s = getter(n)
      if (s && s.length > 0) {
        return s
      }
    }
    return undefined
  }

  const primary = pgNodes[pgNodes.length - 1] as Record<string, unknown>
  const codeRaw = primary.code
  if (typeof codeRaw !== "string" || !PG_CODE.test(codeRaw)) {
    return null
  }
  const code = codeRaw
  const driverMessage =
    (typeof primary.message === "string" && primary.message.length > 0
      ? primary.message
      : pickFirstString((n) => (typeof n.message === "string" ? n.message : undefined))) ||
    "PostgreSQL error (no message)"

  let column = pickFirstString((n) => (typeof n.column === "string" ? n.column : undefined))
  let table = pickFirstString((n) => (typeof n.table === "string" ? n.table : undefined))
  const detail = pickFirstString((n) => (typeof n.detail === "string" ? n.detail : undefined))
  const constraint = pickFirstString((n) => (typeof n.constraint === "string" ? n.constraint : undefined))

  if (code === "42703" || code === "42P01") {
    if (!column) {
      const m =
        driverMessage.match(/column "([^"]+)"\s+of relation\s+"([^"]+)"/) ??
        driverMessage.match(/column '([^']+)'\s+of relation '([^']+)'/i) ??
        driverMessage.match(/column "([^"]+)"/) ??
        driverMessage.match(/column '([^']+)'/i)
      if (m?.[1]) {
        column = m[1]
      }
      if (m?.[2]) {
        table = m[2]
      }
    }
    if (!table) {
      const t = driverMessage.match(/of relation "([^"]+)"/) ?? driverMessage.match(/relation "([^"]+)"/i)
      if (t?.[1]) {
        table = t[1]
      }
    }
  }

  return {
    code,
    column,
    table,
    detail,
    constraint,
    driverMessage,
  }
}
