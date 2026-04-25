import type { IncomingMessage, ServerResponse } from "node:http"
import { ZodError } from "zod"

import type { ApiEnv } from "../../config/env.js"
import { getDatabaseClient } from "../../db/client.js"
import { readJsonBody, sendJson } from "../../http/json.js"
import { getRequestPath } from "../../http/routes.js"
import { requireAuthenticatedRequest } from "../auth/auth.middleware.js"
import { AuthorizationError, sendForbidden } from "../auth/authorization.js"
import { AuthService } from "../auth/auth.service.js"
import { ProductBundlesRepository } from "../product-bundles/product-bundles.repository.js"
import { UsersRepository } from "../users/users.repository.js"
import { SellableProductPriceRulesRepository } from "./sellable-product-price-rules.repository.js"
import {
  createSellableProductPriceRuleRequestSchema,
  sellableProductPriceRuleDefaultQuerySchema,
  sellableProductPriceRuleIdSchema,
  sellableProductPriceRuleListQuerySchema,
  updateSellableProductPriceRuleRequestSchema,
} from "./sellable-product-price-rules.schemas.js"
import {
  SellableProductPriceRuleNotFoundError,
  SellableProductPriceRulesService,
  SellableProductPriceRuleValidationError,
} from "./sellable-product-price-rules.service.js"

interface SellableProductPriceRulesRouteContext {
  env: ApiEnv & { authSessionSecret: string }
}

export async function handleSellableProductPriceRulesRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: SellableProductPriceRulesRouteContext,
): Promise<boolean> {
  const path = getRequestPath(request)

  if (path === "/sellable-product-price-rules" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = sellableProductPriceRuleListQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, { sellable_product_price_rules: await service.list(query, user) })
    })
    return true
  }

  if (path === "/sellable-product-price-rules" && request.method === "POST") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = createSellableProductPriceRuleRequestSchema.parse(await readJsonBody(request))

      sendJson(response, 201, { sellable_product_price_rule: await service.create(input, user) })
    })
    return true
  }

  if (path === "/sellable-product-price-rules/default" && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const query = sellableProductPriceRuleDefaultQuerySchema.parse(
        Object.fromEntries(new URL(request.url ?? "/", "http://localhost").searchParams),
      )

      sendJson(response, 200, {
        sellable_product_price_rule: await service.resolveDefaultPriceRule(query, user),
      })
    })
    return true
  }

  const idMatch = path.match(/^\/sellable-product-price-rules\/([^/]+)$/)

  if (idMatch && request.method === "GET") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      sendJson(response, 200, {
        sellable_product_price_rule: await service.getById(
          sellableProductPriceRuleIdSchema.parse(idMatch[1]),
          user,
        ),
      })
    })
    return true
  }

  if (idMatch && request.method === "PATCH") {
    await withAuthenticatedUser(request, response, context, async (service, user) => {
      const input = updateSellableProductPriceRuleRequestSchema.parse(await readJsonBody(request))

      sendJson(response, 200, {
        sellable_product_price_rule: await service.update(
          sellableProductPriceRuleIdSchema.parse(idMatch[1]),
          input,
          user,
        ),
      })
    })
    return true
  }

  return false
}

async function withAuthenticatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  context: SellableProductPriceRulesRouteContext,
  handler: (
    service: SellableProductPriceRulesService,
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

    const db = getDatabaseClient()

    await handler(
      new SellableProductPriceRulesService(
        new SellableProductPriceRulesRepository(db),
        new ProductBundlesRepository(db),
      ),
      authContext.user,
    )
  } catch (error) {
    handleSellableProductPriceRulesError(response, error)
  }
}

function handleSellableProductPriceRulesError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError) {
    sendJson(response, 400, {
      error: "Invalid sellable product price rule request",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    })
    return
  }

  if (error instanceof SyntaxError) {
    sendJson(response, 400, {
      error: "Invalid sellable product price rule request",
      details: [{ path: "", message: "Request body must be valid JSON." }],
    })
    return
  }

  if (error instanceof AuthorizationError) {
    sendForbidden(response, error)
    return
  }

  if (
    error instanceof SellableProductPriceRuleNotFoundError ||
    error instanceof SellableProductPriceRuleValidationError
  ) {
    sendJson(response, error.statusCode, { error: error.message })
    return
  }

  throw error
}
