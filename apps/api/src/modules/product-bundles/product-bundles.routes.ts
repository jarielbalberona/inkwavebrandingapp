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
import { ProductBundlesRepository } from "./product-bundles.repository.js"
import {
  createProductBundleRequestSchema,
  productBundleIdSchema,
  productBundleListQuerySchema,
  updateProductBundleRequestSchema,
} from "./product-bundles.schemas.js"
import {
  DuplicateProductBundleNameError,
  ProductBundleNotFoundError,
  ProductBundlePersistenceValidationError,
  ProductBundlesService,
} from "./product-bundles.service.js"

interface ProductBundlesRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleProductBundlesRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: ProductBundlesRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/product-bundles" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = productBundleListQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, { product_bundles: await service.list(query, user) })
    })
    return true
  }

  if (path === "/product-bundles" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createProductBundleRequestSchema.parse(await readJsonBody(request))

      sendJson(response, 201, { product_bundle: await service.create(input, user) })
    })
    return true
  }

  const idMatch = path.match(/^\/product-bundles\/([^/]+)$/)

  if (idMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        product_bundle: await service.getById(productBundleIdSchema.parse(idMatch[1]), user),
      })
    })
    return true
  }

  if (idMatch && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = updateProductBundleRequestSchema.parse(await readJsonBody(request))

      sendJson(response, 200, {
        product_bundle: await service.update(productBundleIdSchema.parse(idMatch[1]), input, user),
      })
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: ProductBundlesRouteContext,
  handler: (
    service: ProductBundlesService,
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

    await handler(
      new ProductBundlesService(new ProductBundlesRepository(getDatabaseClient())),
      authContext.user,
    )
  } catch (error) {
    handleProductBundlesError(response, error)
  }
}

function handleProductBundlesError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError) {
    sendJson(response, 400, {
      error: "Invalid product bundle request",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    })
    return
  }

  if (error instanceof SyntaxError) {
    sendJson(response, 400, {
      error: "Invalid product bundle request",
      details: [{ path: "", message: "Request body must be valid JSON." }],
    })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (
    error instanceof DuplicateProductBundleNameError ||
    error instanceof ProductBundleNotFoundError ||
    error instanceof ProductBundlePersistenceValidationError
  ) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
