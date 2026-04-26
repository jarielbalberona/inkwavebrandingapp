import { z } from "zod"

import { ApiClientError, api, apiBaseUrl, skipErrorToast } from "@/lib/api"
import { appPermissions } from "@/features/auth/permissions"

const appPermissionSchema = z.enum([
  appPermissions.dashboardView,
  appPermissions.usersManage,
  appPermissions.customersView,
  appPermissions.customersManage,
  appPermissions.customersConfidentialView,
  appPermissions.cupsView,
  appPermissions.catalogPricingView,
  appPermissions.cupsManage,
  appPermissions.lidsView,
  appPermissions.lidsManage,
  appPermissions.nonStockItemsView,
  appPermissions.nonStockItemsManage,
  appPermissions.productBundlesView,
  appPermissions.productBundlesManage,
  appPermissions.sellableProductPriceRulesView,
  appPermissions.sellableProductPriceRulesManage,
  appPermissions.inventoryView,
  appPermissions.inventoryStockIntake,
  appPermissions.inventoryAdjust,
  appPermissions.ordersView,
  appPermissions.ordersManage,
  appPermissions.ordersFulfillmentRecord,
  appPermissions.ordersCustomChargesManage,
  appPermissions.ordersPricingView,
  appPermissions.invoicesView,
  appPermissions.invoicesManage,
  appPermissions.reportsView,
  appPermissions.reportsFinancialView,
])

export const authenticatedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  role: z.enum(["admin", "staff"]),
  permissions: z.array(appPermissionSchema),
})

const authResponseSchema = z.object({
  user: authenticatedUserSchema,
})

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>

export interface LoginInput {
  email: string
  password: string
}

const sessionVerificationDelaysMs = [0, 150, 500] as const

export class AuthApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function fetchCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const response = await api.get<unknown>("/auth/me", {
      meta: skipErrorToast(),
    })

    return authResponseSchema.parse(response).user
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return null
    }

    if (error instanceof ApiClientError) {
      throw new AuthApiError("Unable to load current user", error.status)
    }

    throw error
  }
}

export async function login(input: LoginInput): Promise<AuthenticatedUser> {
  try {
    const response = await api.post<unknown, LoginInput>("/auth/login", input, {
      meta: skipErrorToast(),
    })

    authResponseSchema.parse(response)

    const verifiedUser = await verifyCurrentUserSession()

    if (!verifiedUser) {
      throw new AuthApiError("Session was not established", 401)
    }

    return verifiedUser
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      throw new AuthApiError("Invalid email or password", error.status)
    }

    if (error instanceof AuthApiError && error.status === 401) {
      throw new AuthApiError(getSessionPersistenceErrorMessage(), error.status)
    }

    if (error instanceof ApiClientError) {
      throw new AuthApiError("Unable to sign in", error.status)
    }

    throw error
  }
}

async function verifyCurrentUserSession(): Promise<AuthenticatedUser | null> {
  for (const delayMs of sessionVerificationDelaysMs) {
    if (delayMs > 0) {
      await delay(delayMs)
    }

    const user = await fetchCurrentUser()
    if (user) {
      return user
    }
  }

  return null
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getSessionPersistenceErrorMessage(): string {
  if (isApiCrossOrigin()) {
    return "Sign in succeeded, but this browser blocked the session cookie. Use the primary app URL, and make sure the web app and API are same-site or proxied under one origin."
  }

  return "Sign in succeeded, but the session was not persisted."
}

function isApiCrossOrigin(): boolean {
  try {
    return new URL(apiBaseUrl, window.location.href).origin !== window.location.origin
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout", undefined, {
      meta: skipErrorToast(),
    })
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new AuthApiError("Unable to sign out", error.status)
    }

    throw error
  }
}
