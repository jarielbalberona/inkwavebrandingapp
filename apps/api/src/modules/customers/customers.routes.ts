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
import {
  createCustomerSchema,
  customerIdSchema,
  customerListQuerySchema,
  updateCustomerSchema,
} from "./customers.schemas.js"
import {
  CustomerNotFoundError,
  CustomersService,
  DuplicateCustomerCodeError,
} from "./customers.service.js"
import { CustomersRepository } from "./customers.repository.js"

interface CustomersRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleCustomersRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: CustomersRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/customers" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = customerListQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, { customers: await service.list(query, user) })
    })
    return true
  }

  if (path === "/customers" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createCustomerSchema.parse(await readJsonBody(request))

      sendJson(response, 201, { customer: await service.create(input, user) })
    })
    return true
  }

  const idMatch = path.match(/^\/customers\/([^/]+)$/)

  if (idMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        customer: await service.getById(customerIdSchema.parse(idMatch[1]), user),
      })
    })
    return true
  }

  if (idMatch && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = updateCustomerSchema.parse(await readJsonBody(request))

      sendJson(response, 200, {
        customer: await service.update(customerIdSchema.parse(idMatch[1]), input, user),
      })
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: CustomersRouteContext,
  handler: (
    service: CustomersService,
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

    await handler(new CustomersService(new CustomersRepository(getDatabaseClient())), authContext.user)
  } catch (error) {
    handleCustomersError(response, error)
  }
}

function handleCustomersError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    sendJson(response, 400, { error: "Invalid customer request" })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (error instanceof CustomerNotFoundError || error instanceof DuplicateCustomerCodeError) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
