export interface PreparedEmailMessage {
  subject: string
  html: string
  text: string
}

export interface SendEmailOptions extends PreparedEmailMessage {
  to: string | string[]
  replyTo?: string
}

export interface SendEmailResult {
  id?: string
  provider: "resend"
}

export class EmailProviderError extends Error {
  readonly retryable: boolean
  readonly code?: string

  constructor(message: string, options: { retryable: boolean; code?: string; cause?: unknown }) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = "EmailProviderError"
    this.retryable = options.retryable
    this.code = options.code
  }
}

export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>
}
