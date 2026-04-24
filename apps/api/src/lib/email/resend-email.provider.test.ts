import assert from "node:assert/strict"
import test from "node:test"

import { EmailProviderError } from "./email.types.js"
import { ResendEmailProvider } from "./resend-email.provider.js"

test("ResendEmailProvider forwards send payload and applies default reply-to", async () => {
  let sentPayload: Record<string, unknown> | undefined

  const provider = new ResendEmailProvider(
    {
      resendApiKey: "test-key",
      resendFromEmail: "ops@inkwave.test",
      resendReplyToEmail: "help@inkwave.test",
    },
    {
      emails: {
        async send(input) {
          sentPayload = input
          return { data: { id: "email_123" }, error: null }
        },
      },
    },
  )

  const result = await provider.sendEmail({
    to: "admin@inkwave.test",
    subject: "Low stock alert",
    html: "<p>Hello</p>",
    text: "Hello",
  })

  assert.deepEqual(sentPayload, {
    from: "ops@inkwave.test",
    to: ["admin@inkwave.test"],
    subject: "Low stock alert",
    html: "<p>Hello</p>",
    text: "Hello",
    replyTo: "help@inkwave.test",
  })
  assert.deepEqual(result, { id: "email_123", provider: "resend" })
})

test("ResendEmailProvider classifies retryable provider failures", async () => {
  const provider = new ResendEmailProvider(
    {
      resendApiKey: "test-key",
      resendFromEmail: "ops@inkwave.test",
      resendReplyToEmail: undefined,
    },
    {
      emails: {
        async send() {
          return {
            data: null,
            error: {
              name: "rate_limit",
              message: "Rate limit exceeded",
              statusCode: 429,
            },
          }
        },
      },
    },
  )

  await assert.rejects(
    () =>
      provider.sendEmail({
        to: "admin@inkwave.test",
        subject: "Digest",
        html: "<p>Hello</p>",
        text: "Hello",
      }),
    (error: unknown) => {
      assert.ok(error instanceof EmailProviderError)
      assert.equal(error.retryable, true)
      assert.equal(error.code, "rate_limit")
      return true
    },
  )
})

test("ResendEmailProvider classifies terminal provider failures", async () => {
  const provider = new ResendEmailProvider(
    {
      resendApiKey: "test-key",
      resendFromEmail: "ops@inkwave.test",
      resendReplyToEmail: undefined,
    },
    {
      emails: {
        async send() {
          return {
            data: null,
            error: {
              name: "validation_error",
              message: "Sender domain is not verified",
              statusCode: 400,
            },
          }
        },
      },
    },
  )

  await assert.rejects(
    () =>
      provider.sendEmail({
        to: "admin@inkwave.test",
        subject: "Digest",
        html: "<p>Hello</p>",
        text: "Hello",
      }),
    (error: unknown) => {
      assert.ok(error instanceof EmailProviderError)
      assert.equal(error.retryable, false)
      assert.equal(error.code, "validation_error")
      return true
    },
  )
})
