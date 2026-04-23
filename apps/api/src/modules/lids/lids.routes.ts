import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import { UsersRepository } from "../users/users.repository.js"
import { LidsRepository } from "./lids.repository.js"
import {
  createLidSchema,
  lidIdSchema,
  lidListQuerySchema,
  updateLidSchema,
} from "./lids.schemas.js"
import {
  DuplicateLidError,
  LidIdentityLockedError,
  LidNotFoundError,
  LidsService,
} from "./lids.service.js"

interface LidsRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleLidsRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: LidsRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/lids" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = lidListQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, { lids: await service.list(query, user) })
    })
    return true
  }

  if (path === "/lids" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createLidSchema.parse(await readJsonBody(request))

      sendJson(response, 201, { lid: await service.create(input, user) })
    })
    return true
  }

  const idMatch = path.match(/^\/lids\/([^/]+)$/)

  if (idMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        lid: await service.getById(lidIdSchema.parse(idMatch[1]), user),
      })
    })
    return true
  }

  if (idMatch && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = updateLidSchema.parse(await readJsonBody(request))

      sendJson(response, 200, {
        lid: await service.update(lidIdSchema.parse(idMatch[1]), input, user),
      })
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: LidsRouteContext,
  handler: (
    service: LidsService,
    user: NonNullable<Awaited<ReturnType<AuthService["getCurrentUser"]>>>,
  ) => Promise<void>,
) {
  try {
    const authContext = await requireAuthenticatedRequest(request, response, {
      createAuthService: () => new AuthService(new UsersRepository(getDatabaseClient())),
      env: context.env,
    })

    if (!authContext) {
      return
    }

    await handler(new LidsService(new LidsRepository(getDatabaseClient())), authContext.user)
  } catch (error) {
    handleLidsError(response, error)
  }
}

function handleLidsError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    sendJson(response, 400, { error: "Invalid lid request" })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (
    error instanceof LidNotFoundError ||
    error instanceof DuplicateLidError ||
    error instanceof LidIdentityLockedError
  ) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
