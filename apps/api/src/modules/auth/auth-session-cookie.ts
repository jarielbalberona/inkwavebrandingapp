import type { ApiEnv } from "../../config/env.js"
import type { CookieOptions } from "../../http/cookies.js"

/**
 * Browsers do not send `SameSite=Lax` cookies on cross-site XHR/fetch (e.g. SPA
 * on one Render hostname calling the API on another). Use `None`+`Secure` in
 * production for credentialed CORS, unless you proxy the API same-origin.
 * With `SameSite=None`, add `Partitioned` (CHIPS) so WebKit/Safari actually
 * stores and resends the cookie on follow-up credentialed requests.
 */
export function authSessionCookieOptions(
  env: ApiEnv,
  maxAgeSeconds: number,
): Required<
  Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure" | "maxAgeSeconds" | "partitioned">
> {
  const sameSite = env.authSessionSameSite
  const secure = sameSite === "None" || env.nodeEnv === "production"
  return {
    httpOnly: true,
    maxAgeSeconds,
    path: "/",
    sameSite,
    secure,
    partitioned: sameSite === "None",
  }
}
