import { Resend } from "resend"

import type { ApiEnv } from "../../config/env.js"
import {
  EmailProviderError,
} from "./email.types.js"
import type {
  EmailProvider,
  SendEmailOptions,
  SendEmailResult,
} from "./email.types.js"

interface ResendSendResponse {
  data?: { id?: string } | null
  error?: {
    name?: string
    message: string
    statusCode?: number | null
  } | null
}

interface ResendClient {
  emails: {
    send(input: {
      from: string
      to: string[]
      subject: string
      html: string
      text: string
      replyTo?: string
    }): Promise<ResendSendResponse>
  }
}

export class ResendEmailProvider implements EmailProvider {
  private readonly resend: ResendClient
  private readonly from: string
  private readonly replyTo?: string

  constructor(
    env: Pick<ApiEnv, "resendApiKey" | "resendFromEmail" | "resendReplyToEmail">,
    resendClient?: ResendClient,
  ) {
    if (!env.resendApiKey) {
      throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend")
    }

    if (!env.resendFromEmail) {
      throw new Error("RESEND_FROM_EMAIL is required when EMAIL_PROVIDER=resend")
    }

    this.resend = resendClient ?? (new Resend(env.resendApiKey) as unknown as ResendClient)
    this.from = env.resendFromEmail
    this.replyTo = env.resendReplyToEmail
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const result = await this.resend.emails.send({
      from: this.from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo ?? this.replyTo,
    })

    if (result.error) {
      throw classifyResendError(result.error)
    }

    return {
      id: result.data?.id,
      provider: "resend",
    }
  }
}

function classifyResendError(error: NonNullable<ResendSendResponse["error"]>): EmailProviderError {
  const statusCode = error.statusCode
  const message = error.message
  const normalized = message.toLowerCase()
  const retryable =
    (typeof statusCode === "number" && statusCode >= 500) ||
    statusCode === 429 ||
    /timeout|timed out|rate limit|temporar|network|unavailable|socket|econnreset|etimedout/.test(
      normalized,
    )

  return new EmailProviderError(message, {
    retryable,
    code: error.name ?? (statusCode ? `http_${statusCode}` : undefined),
    cause: error,
  })
}
