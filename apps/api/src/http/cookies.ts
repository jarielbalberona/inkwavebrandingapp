export function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>()

  if (!cookieHeader) {
    return cookies
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.split("=")
    const name = rawName?.trim()

    if (!name) {
      continue
    }

    cookies.set(name, decodeURIComponent(rawValue.join("=").trim()))
  }

  return cookies
}

export interface CookieOptions {
  httpOnly?: boolean
  maxAgeSeconds?: number
  path?: string
  sameSite?: "Lax" | "Strict" | "None"
  secure?: boolean
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`)
  }

  parts.push(`Path=${options.path ?? "/"}`)

  if (options.httpOnly) {
    parts.push("HttpOnly")
  }

  parts.push(`SameSite=${options.sameSite ?? "Lax"}`)

  if (options.secure) {
    parts.push("Secure")
  }

  return parts.join("; ")
}
