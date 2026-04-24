import { describe, expect, it } from "vitest"

import {
  getAdminSessionCookie,
  getIntegrationRequest,
  getStaffSessionCookie,
  useIntegrationHarness,
} from "./harness.js"

describe("users integration", () => {
  useIntegrationHarness()

  it("lets admins list users and blocks staff access", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const staffCookie = await getStaffSessionCookie()

    const adminResponse = await api
      .get("/users")
      .set("Cookie", adminCookie)

    expect(adminResponse.status).toBe(200)
    expect(adminResponse.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "admin" }),
        expect.objectContaining({ role: "staff" }),
      ]),
    )

    const staffResponse = await api
      .get("/users")
      .set("Cookie", staffCookie)

    expect(staffResponse.status).toBe(403)
    expect(staffResponse.body.error).toBe("Manage users permission required")
  })

  it("lets admins create staff accounts that can log in", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()

    const createResponse = await api
      .post("/users")
      .set("Cookie", adminCookie)
      .send({
        email: "new.staff@inkwave.test",
        displayName: "New Staff",
        password: "strongpassword123",
        role: "staff",
      })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.user).toMatchObject({
      email: "new.staff@inkwave.test",
      display_name: "New Staff",
      role: "staff",
      is_active: true,
    })

    const loginResponse = await api
      .post("/auth/login")
      .send({
        email: "new.staff@inkwave.test",
        password: "strongpassword123",
      })

    expect(loginResponse.status).toBe(200)
    expect(loginResponse.body.user).toMatchObject({
      email: "new.staff@inkwave.test",
      role: "staff",
    })
  })

  it("blocks staff from creating accounts", async () => {
    const api = await getIntegrationRequest()
    const staffCookie = await getStaffSessionCookie()

    const response = await api
      .post("/users")
      .set("Cookie", staffCookie)
      .send({
        email: "blocked.staff@inkwave.test",
        password: "strongpassword123",
        role: "staff",
      })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe("Manage users permission required")
  })
})
