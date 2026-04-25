import assert from "node:assert/strict"
import test from "node:test"
import request from "supertest"

import { createApiServer } from "./app.js"
import { parseApiEnv } from "./config/env.js"

test("CORS preflight allows invoice payment deletion from configured web origin", async () => {
  const env = {
    ...parseApiEnv({
      NODE_ENV: "test",
      AUTH_SESSION_SECRET: "test-session-secret-with-at-least-32-chars",
      WEB_ORIGIN: "https://app.inkwavebrand.ing",
    }),
    authSessionSecret: "test-session-secret-with-at-least-32-chars",
  }

  const response = await request(createApiServer(env))
    .options("/invoices/invoice-id/payments/payment-id")
    .set("Origin", "https://app.inkwavebrand.ing")
    .set("Access-Control-Request-Method", "DELETE")
    .set("Access-Control-Request-Headers", "accept,content-type")

  assert.equal(response.status, 204)
  assert.equal(response.headers["access-control-allow-origin"], "https://app.inkwavebrand.ing")
  assert.match(response.headers["access-control-allow-methods"], /\bDELETE\b/)
  const allowHeaders = String(response.headers["access-control-allow-headers"] ?? "")
  assert.match(allowHeaders, /Accept/i)
  assert.match(allowHeaders, /Content-Type/i)
})
