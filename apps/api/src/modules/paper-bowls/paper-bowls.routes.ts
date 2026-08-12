import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthService } from "../auth/auth.service.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { UsersRepository } from "../users/users.repository.js"
import { PaperBowlsRepository } from "./paper-bowls.repository.js"
import {
  createPaperBowlRequestSchema,
  paperBowlIdSchema,
  paperBowlListQuerySchema,
  updatePaperBowlRequestSchema,
} from "./paper-bowls.schemas.js"
import {
  DuplicatePaperBowlError,
  PaperBowlNotFoundError,
  PaperBowlsService,
} from "./paper-bowls.service.js"

export async function handlePaperBowlsRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: { env: ApiEnv & { authSessionSecret: string } },
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/paper-bowls" && request.method === "GET") {
    await withUser(request, response, context, async (service, user) => {
      const query = paperBowlListQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )
      sendJson(response, 200, { paper_bowls: await service.list(query, user) })
    })
    return true
  }

  if (path === "/paper-bowls" && request.method === "POST") {
    await withUser(request, response, context, async (service, user) => {
      sendJson(response, 201, {
        paper_bowl: await service.create(
          createPaperBowlRequestSchema.parse(await readJsonBody(request)),
          user,
        ),
      })
    })
    return true
  }

  const idMatch = path.match(/^\/paper-bowls\/([^/]+)$/)
  if (idMatch && request.method === "PATCH") {
    await withUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        paper_bowl: await service.update(
          paperBowlIdSchema.parse(idMatch[1]),
          updatePaperBowlRequestSchema.parse(await readJsonBody(request)),
          user,
        ),
      })
    })
    return true
  }

  return false
}

async function withUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: { env: ApiEnv & { authSessionSecret: string } },
  handler: (service: PaperBowlsService, user: NonNullable<Awaited<ReturnType<AuthService["getCurrentUser"]>>>) => Promise<void>,
) {
  try {
    const auth = await requireAuthenticatedRequest(request, response, {
      createAuthService: () => new AuthService(new UsersRepository(getDatabaseClient())),
      env: context.env,
    })
    if (!auth) return
    await handler(
      new PaperBowlsService(new PaperBowlsRepository(getDatabaseClient())),
      auth.user,
    )
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid paper bowl request" })
      return
    }
    if (error instanceof AuthorizationError) {
      sendForbidden(response, error)
      return
    }
    if (error instanceof PaperBowlNotFoundError || error instanceof DuplicatePaperBowlError) {
      sendJson(response, error.statusCode, { error: error.message })
      return
    }
    throw error
  }
}
