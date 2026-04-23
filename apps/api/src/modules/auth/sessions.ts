import { createHmac, timingSafeEqual } from "node:crypto"

const SESSION_VERSION = 1

interface SessionPayload {
  exp: number
  sub: string
  v: typeof SESSION_VERSION
}

export interface SessionConfig {
  secret: string
  ttlSeconds: number
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8")
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createSessionToken(userId: string, config: SessionConfig): string {
  const payload: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + config.ttlSeconds,
    sub: userId,
    v: SESSION_VERSION,
  }
  const encodedPayload = toBase64Url(JSON.stringify(payload))

  return `${encodedPayload}.${sign(encodedPayload, config.secret)}`
}

export function verifySessionToken(token: string, config: Pick<SessionConfig, "secret">): string | null {
  const [encodedPayload, signature] = token.split(".")

  if (!encodedPayload || !signature) {
    return null
  }

  if (!safeEqual(signature, sign(encodedPayload, config.secret))) {
    return null
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<SessionPayload>

    if (payload.v !== SESSION_VERSION || !payload.sub || !payload.exp) {
      return null
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload.sub
  } catch {
    return null
  }
}
