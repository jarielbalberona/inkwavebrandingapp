type LogLevel = "info" | "error"

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

interface LogPayload {
  event: string
  [key: string]: JsonValue
}

export function logInfo(payload: LogPayload) {
  writeLog("info", payload)
}

export function logError(payload: LogPayload) {
  writeLog("error", payload)
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

function writeLog(level: LogLevel, payload: LogPayload) {
  const entry = JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    ...payload,
  })

  if (level === "error") {
    console.error(entry)
    return
  }

  console.log(entry)
}
