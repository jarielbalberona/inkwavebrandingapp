import type { IncomingMessage, ServerResponse } from "node:http"

import type { ApiEnv } from "../../config/env.js"
import { parseCookies, serializeCookie } from "../../http/cookies.js"
import { sendJson } from "../../http/json.js"
import { AuthService } from "./auth.service.js"
import type { SafeUser } from "./auth.schemas.js"
import { AUTH_SESSION_COOKIE } from "./auth.constants.js"
import { authSessionCookieOptions } from "./auth-session-cookie.js"
import { verifySessionToken } from "./sessions.js"

export interface AuthenticatedRequestContext {
  user: SafeUser
}

export interface AuthMiddlewareContext {
  createAuthService: () => AuthService
  env: ApiEnv & { authSessionSecret: string }
}

export async function authenticateRequest(
  request: IncomingMessage,
  context: AuthMiddlewareContext,
): Promise<AuthenticatedRequestContext | null> {
  const token = parseCookies(request.headers.cookie).get(AUTH_SESSION_COOKIE)
  const userId = token
    ? verifySessionToken(token, { secret: context.env.authSessionSecret })
    : null

  if (!userId) {
    return null
  }

  const user = await context.createAuthService().getCurrentUser(userId)

  return user ? { user } : null
}

export async function requireAuthenticatedRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: AuthMiddlewareContext,
): Promise<AuthenticatedRequestContext | null> {
  const authContext = await authenticateRequest(request, context)

  if (authContext) {
    return authContext
  }

  sendUnauthenticated(response, context)
  return null
}

export function sendUnauthenticated(
  response: ServerResponse,
  context: Pick<AuthMiddlewareContext, "env">,
) {
  sendJson(response, 401, { error: "Unauthenticated" }, {
    "Set-Cookie": serializeCookie(AUTH_SESSION_COOKIE, "", authSessionCookieOptions(context.env, 0)),
  })
}
