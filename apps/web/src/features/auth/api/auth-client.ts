import { z } from "zod"

import { ApiClientError, api, skipErrorToast } from "@/lib/api"
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
  appPermissions.inventoryView,
  appPermissions.inventoryStockIntake,
  appPermissions.inventoryAdjust,
  appPermissions.ordersView,
  appPermissions.ordersManage,
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

    return authResponseSchema.parse(response).user
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      throw new AuthApiError("Invalid email or password", error.status)
    }

    if (error instanceof ApiClientError) {
      throw new AuthApiError("Unable to sign in", error.status)
    }

    throw error
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
