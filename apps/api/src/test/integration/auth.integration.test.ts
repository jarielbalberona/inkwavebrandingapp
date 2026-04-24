import { describe, expect, it } from "vitest"

import { getIntegrationRequest, integrationAdmin, loginAsAdmin, useIntegrationHarness } from "./harness.js"

describe("integration harness", () => {
  useIntegrationHarness()

  it("serves the public health endpoint against disposable postgres state", async () => {
    const api = await getIntegrationRequest()
    const response = await api.get("/health")

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
  })

  it("authenticates a seeded admin user through the real login route", async () => {
    const response = await loginAsAdmin()

    expect(response.status).toBe(200)
    expect(response.body.user.email).toBe(integrationAdmin.email)
    expect(response.headers["set-cookie"]).toBeDefined()
  })
})
