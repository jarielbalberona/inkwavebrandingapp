import assert from "node:assert/strict"
import test from "node:test"

import { DailyDigestRecipientResolver } from "./daily-digest-recipient-resolver.js"

test("DailyDigestRecipientResolver returns stable deduped active admin recipients", async () => {
  const resolver = new DailyDigestRecipientResolver({
    async listActiveAdmins() {
      return [
        {
          email: " OWNER@inkwave.test ",
          displayName: "Owner",
          role: "admin",
          isActive: true,
        },
        {
          email: "owner@inkwave.test",
          displayName: "Duplicate",
          role: "admin",
          isActive: true,
        },
        {
          email: "staff@inkwave.test",
          displayName: "Staff",
          role: "staff",
          isActive: true,
        },
        {
          email: "ops@inkwave.test",
          displayName: "  ",
          role: "admin",
          isActive: true,
        },
        {
          email: "inactive@inkwave.test",
          displayName: "Inactive",
          role: "admin",
          isActive: false,
        },
      ]
    },
  })

  assert.deepEqual(await resolver.resolve(), [
    { email: "ops@inkwave.test" },
    { email: "owner@inkwave.test", name: "Owner" },
  ])
})
