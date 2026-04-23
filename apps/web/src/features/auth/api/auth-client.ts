import { z } from "zod"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

export const authenticatedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  role: z.enum(["admin", "staff"]),
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
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    credentials: "include",
  })

  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new AuthApiError("Unable to load current user", response.status)
  }

  return authResponseSchema.parse(await response.json()).user
}

export async function login(input: LoginInput): Promise<AuthenticatedUser> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })

  if (response.status === 401) {
    throw new AuthApiError("Invalid email or password", response.status)
  }

  if (!response.ok) {
    throw new AuthApiError("Unable to sign in", response.status)
  }

  return authResponseSchema.parse(await response.json()).user
}

export async function logout(): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/auth/logout`, {
    method: "POST",
    credentials: "include",
  })

  if (!response.ok) {
    throw new AuthApiError("Unable to sign out", response.status)
  }
}
