import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import {
  createUserSchema,
  updateStaffUserSchema,
} from "./users.schemas.js"
import { UsersRepository } from "./users.repository.js"
import {
  DuplicateUserEmailError,
  UserNotFoundError,
  UserPermissionAssignmentError,
  UsersService,
} from "./users.service.js"

interface UsersRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleUsersRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: UsersRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/users" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, await service.list(user))
    })
    return true
  }

  if (path === "/users" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createUserSchema.parse(await readJsonBody(request))

      sendJson(response, 201, { user: await service.create(input, user) })
    })
    return true
  }

  const permissionsMatch = path.match(/^\/users\/([^/]+)\/permissions$/)

  if (permissionsMatch && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = updateStaffUserSchema.parse(await readJsonBody(request))

      sendJson(response, 200, {
        user: await service.updatePermissions(permissionsMatch[1]!, input, user),
      })
    })
    return true
  }

  const archiveMatch = path.match(/^\/users\/([^/]+)\/archive$/)

  if (archiveMatch && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        user: await service.archive(archiveMatch[1]!, user),
      })
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: UsersRouteContext,
  handler: (
    service: UsersService,
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

    await handler(new UsersService(new UsersRepository(getDatabaseClient())), authContext.user)
  } catch (error) {
    handleUsersError(response, error)
  }
}

function handleUsersError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    sendJson(response, 400, { error: "Invalid user request" })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (
    error instanceof DuplicateUserEmailError ||
    error instanceof UserNotFoundError ||
    error instanceof UserPermissionAssignmentError
  ) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
