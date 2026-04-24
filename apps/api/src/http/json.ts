import type { IncomingMessage, ServerResponse } from "node:http"

import { record5xxResponseBodyForLogging } from "./response-log.js"

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  const body = Buffer.concat(chunks).toString("utf8")

  if (!body.trim()) {
    return {}
  }

  return JSON.parse(body)
}

export function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string | string[]> = {},
) {
  record5xxResponseBodyForLogging(response, statusCode, body)
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  })
  response.end(JSON.stringify(body))
}
