import type { ServerResponse } from "node:http"

import { serializeError } from "../lib/logger.js"

const RESPONSE_LOG = Symbol("inkwaveResponseLog")

const MAX_ERROR_TEXT = 2_000

type SerializedError = {
  name: string
  message: string
  stack: string | null
}

export interface HttpResponseLog {
  unhandledError?: SerializedError
  clientError?: {
    error: string
    code?: string
    column?: string
    table?: string
    detail?: string
    constraint?: string
    pg_message?: string
  }
}

function getLog(response: ServerResponse): HttpResponseLog {
  const withSymbol = response as ServerResponse & { [RESPONSE_LOG]?: HttpResponseLog }
  const existing = withSymbol[RESPONSE_LOG]
  if (existing) {
    return existing
  }
  const created: HttpResponseLog = {}
  withSymbol[RESPONSE_LOG] = created
  return created
}

function patchLog(response: ServerResponse, patch: Partial<HttpResponseLog>): void {
  Object.assign(getLog(response), patch)
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value
  }
  return `${value.slice(0, max)}…`
}

/**
 * Unhandled throw from app.ts: keep stack in logs while still returning a generic JSON body.
 */
export function recordUnhandledErrorOnResponse(response: ServerResponse, error: unknown): void {
  const serialized = serializeError(error) as unknown as SerializedError
  patchLog(response, { unhandledError: serialized })
}

/**
 * When routes send 5xx with a JSON { error, code, ... } body, copy a bounded subset for access logs.
 */
export function record5xxResponseBodyForLogging(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  if (statusCode < 500) {
    return
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return
  }

  const o = body as Record<string, unknown>
  if (typeof o.error !== "string" || o.error.length === 0) {
    return
  }

  const clientError: HttpResponseLog["clientError"] = {
    error: truncate(o.error, MAX_ERROR_TEXT),
  }

  if (typeof o.code === "string") {
    clientError.code = o.code
  }
  if (typeof o.column === "string") {
    clientError.column = o.column
  }
  if (typeof o.table === "string") {
    clientError.table = o.table
  }
  if (typeof o.detail === "string") {
    clientError.detail = truncate(o.detail, MAX_ERROR_TEXT)
  }
  if (typeof o.constraint === "string") {
    clientError.constraint = o.constraint
  }
  if (typeof o.pg_message === "string") {
    clientError.pg_message = truncate(o.pg_message, MAX_ERROR_TEXT)
  }

  patchLog(response, { clientError })
}

export function takeResponseLogForAccessLine(response: ServerResponse): HttpResponseLog | undefined {
  const withSymbol = response as ServerResponse & { [RESPONSE_LOG]?: HttpResponseLog }
  return withSymbol[RESPONSE_LOG]
}
