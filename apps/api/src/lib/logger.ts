/**
 * Structured logging via [Pino](https://github.com/pinojs/pino). JSON to stdout;
 * use `LOG_LEVEL` (e.g. `debug`, `info`, `warn`, `error`) or default `info` in production
 * and `debug` otherwise.
 */
import pino from "pino"

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface LogPayload {
  event: string
  [key: string]: JsonValue
}

const level =
  process.env.LOG_LEVEL ??
  (process.env.NODE_ENV === "production" ? "info" : "debug")

/** Root logger; use `logInfo` / `logError` or create a child with `logger.child({ ... })`. */
export const logger = pino({
  name: "inkwave-api",
  level,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: ["password", "passwordHash", "*.password", "req.headers.authorization", "cookie"],
    censor: "[Redacted]",
  },
})

export function logInfo(payload: LogPayload): void {
  logger.info(payload)
}

export function logError(payload: LogPayload): void {
  logger.error(payload)
}

export function serializeError(error: unknown): Record<string, JsonValue> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    }
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown error",
    stack: null,
  }
}
