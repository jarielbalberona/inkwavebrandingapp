import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { serializeCookie } from "../../http/cookies.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { UsersRepository } from "../users/users.repository.js"
import { AUTH_SESSION_COOKIE } from "./auth.constants.js"
import { requireAuthenticatedRequest } from "./auth.middleware.js"
import { AuthService, AuthenticationError } from "./auth.service.js"
import { loginRequestSchema } from "./auth.schemas.js"
import { createSessionToken } from "./sessions.js"

interface AuthRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleAuthRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: AuthRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/auth/login" && request.method === "POST") {
    await handleLogin(request, response, context)
    return true
  }

  if (path === "/auth/logout" && request.method === "POST") {
    handleLogout(response, context)
    return true
  }

  if (path === "/auth/me" && request.method === "GET") {
    await handleMe(request, response, context)
    return true
  }

  return false
}

function createAuthService() {
  return new AuthService(new UsersRepository(getDatabaseClient()))
}

async function handleLogin(
  request: IncomingMessage,
  response: ServerResponse,
  context: AuthRouteContext,
) {
  try {
    const input = loginRequestSchema.parse(await readJsonBody(request))
    const user = await createAuthService().authenticate(input)
    const token = createSessionToken(user.id, {
      secret: context.env.authSessionSecret,
      ttlSeconds: context.env.authSessionTtlSeconds,
    })

    sendJson(response, 200, { user }, {
      "Set-Cookie": createSessionCookie(token, context),
    })
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid login request" })
      return
    }

    if (error instanceof AuthenticationError) {
      sendJson(response, 401, { error: "Invalid email or password" })
      return
    }

    throw error
  }
}

function handleLogout(response: ServerResponse, context: AuthRouteContext) {
  sendJson(response, 200, { ok: true }, {
    "Set-Cookie": serializeCookie(AUTH_SESSION_COOKIE, "", {
      httpOnly: true,
      maxAgeSeconds: 0,
      path: "/",
      sameSite: "Lax",
      secure: context.env.nodeEnv === "production",
    }),
  })
}

async function handleMe(
  request: IncomingMessage,
  response: ServerResponse,
  context: AuthRouteContext,
) {
  const authContext = await requireAuthenticatedRequest(request, response, {
    createAuthService,
    env: context.env,
  })

  if (!authContext) {
    return
  }

  sendJson(response, 200, { user: authContext.user })
}

function createSessionCookie(token: string, context: AuthRouteContext): string {
  return serializeCookie(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    maxAgeSeconds: context.env.authSessionTtlSeconds,
    path: "/",
    sameSite: "Lax",
    secure: context.env.nodeEnv === "production",
  })
}
