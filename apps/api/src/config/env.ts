import { config as loadDotenvFile } from "dotenv"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

let dotenvLoaded = false

function ensureApiDotenv(): void {
  if (dotenvLoaded) {
    return
  }
  dotenvLoaded = true
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "../../.env")
  loadDotenvFile({ path: envPath })
}

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
)

const optionalSessionSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(32).optional(),
)

export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: optionalNonEmptyString,
  DATABASE_SSL_MODE: z.enum(["disable", "require"]).default("disable"),
  AUTH_SESSION_SECRET: optionalSessionSecret,
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 8),
  WEB_ORIGIN: optionalNonEmptyString,
  SENTRY_DSN: optionalNonEmptyString,
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  OPENAI_API_KEY: optionalNonEmptyString,
})

export type ParsedApiEnv = z.output<typeof apiEnvSchema>
export type DatabaseSslMode = ParsedApiEnv["DATABASE_SSL_MODE"]

export interface ApiEnv {
  nodeEnv: ParsedApiEnv["NODE_ENV"]
  port: number
  databaseUrl?: string
  databaseSslMode: DatabaseSslMode
  authSessionSecret?: string
  authSessionTtlSeconds: number
  webOrigin?: string
  sentryDsn?: string
  sentryTracesSampleRate: number
  openaiApiKey?: string
}

export interface DatabaseEnv {
  databaseUrl: string
  databaseSslMode: DatabaseSslMode
}

export function parseApiEnv(input: unknown): ApiEnv {
  const result = apiEnvSchema.safeParse(input)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")

    throw new Error(`Invalid API environment: ${details}`)
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    databaseUrl: result.data.DATABASE_URL,
    databaseSslMode: result.data.DATABASE_SSL_MODE,
    authSessionSecret: result.data.AUTH_SESSION_SECRET,
    authSessionTtlSeconds: result.data.AUTH_SESSION_TTL_SECONDS,
    webOrigin: result.data.WEB_ORIGIN,
    sentryDsn: result.data.SENTRY_DSN,
    sentryTracesSampleRate: result.data.SENTRY_TRACES_SAMPLE_RATE,
    openaiApiKey: result.data.OPENAI_API_KEY,
  }
}

export function loadApiEnv(): ApiEnv {
  ensureApiDotenv()
  return parseApiEnv(process.env)
}

export function loadDatabaseEnv(): DatabaseEnv {
  const env = loadApiEnv()

  if (!env.databaseUrl) {
    throw new Error("Invalid API environment: DATABASE_URL is required")
  }

  return {
    databaseUrl: env.databaseUrl,
    databaseSslMode: env.databaseSslMode,
  }
}
