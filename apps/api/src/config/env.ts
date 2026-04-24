import { config as loadDotenvFile } from "dotenv"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

const require = createRequire(import.meta.url)
const parsePgConnectionString = require("pg-connection-string") as (
  connectionString: string,
) => Record<string, unknown>

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

/** Strips wrapping quotes and line breaks often introduced by dashboard paste / shell export. */
function normalizeDatabaseUrlValue(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value
  }
  if (typeof value !== "string") {
    return value
  }
  let s = value.trim().replaceAll(/\r|\n/g, "")
  if (s === "") {
    return undefined
  }
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim()
  }
  return s === "" ? undefined : s
}

const optionalDatabaseUrl = z.preprocess(
  normalizeDatabaseUrlValue,
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
  DATABASE_URL: optionalDatabaseUrl,
  DATABASE_SSL_MODE: z.enum(["disable", "require"]).default("disable"),
  AUTH_SESSION_SECRET: optionalSessionSecret,
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 8),
  WEB_ORIGIN: optionalNonEmptyString,
  SENTRY_DSN: optionalNonEmptyString,
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  OPENAI_API_KEY: optionalNonEmptyString,
  STORAGE_PROVIDER: z.enum(["none", "r2"]).default("none"),
  R2_ACCOUNT_ID: optionalNonEmptyString,
  R2_ACCESS_KEY_ID: optionalNonEmptyString,
  R2_SECRET_ACCESS_KEY: optionalNonEmptyString,
  R2_BUCKET_NAME: optionalNonEmptyString,
  R2_ENDPOINT: optionalNonEmptyString,
  R2_PUBLIC_URL: optionalNonEmptyString,
  R2_USE_PUBLIC_CDN: z.coerce.boolean().default(true),
  UPLOAD_MAX_FILE_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  UPLOAD_MAX_REQUEST_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
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
  storageProvider: ParsedApiEnv["STORAGE_PROVIDER"]
  r2AccountId?: string
  r2AccessKeyId?: string
  r2SecretAccessKey?: string
  r2BucketName?: string
  r2Endpoint?: string
  r2PublicUrl?: string
  r2UsePublicCdn: boolean
  uploadMaxFileBytes: number
  uploadMaxRequestBytes: number
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

  const env = {
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
    storageProvider: result.data.STORAGE_PROVIDER,
    r2AccountId: result.data.R2_ACCOUNT_ID,
    r2AccessKeyId: result.data.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: result.data.R2_SECRET_ACCESS_KEY,
    r2BucketName: result.data.R2_BUCKET_NAME,
    r2Endpoint: result.data.R2_ENDPOINT,
    r2PublicUrl: result.data.R2_PUBLIC_URL,
    r2UsePublicCdn: result.data.R2_USE_PUBLIC_CDN,
    uploadMaxFileBytes: result.data.UPLOAD_MAX_FILE_BYTES,
    uploadMaxRequestBytes: result.data.UPLOAD_MAX_REQUEST_BYTES,
  }

  validateStorageEnv(env)

  return env
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

  try {
    parsePgConnectionString(env.databaseUrl)
  } catch {
    throw new Error(
      "Invalid API environment: DATABASE_URL is not a valid PostgreSQL connection URL. " +
        "Copy the full Internal or External URL from your host (including hostname and database name). " +
        "If the password contains @, :, #, /, or ?, percent-encode those characters in the URL.",
    )
  }

  return {
    databaseUrl: env.databaseUrl,
    databaseSslMode: env.databaseSslMode,
  }
}

function validateStorageEnv(env: ApiEnv) {
  if (env.storageProvider !== "r2") {
    return
  }

  const missingFields = [
    ["R2_ACCOUNT_ID", env.r2AccountId],
    ["R2_ACCESS_KEY_ID", env.r2AccessKeyId],
    ["R2_SECRET_ACCESS_KEY", env.r2SecretAccessKey],
    ["R2_BUCKET_NAME", env.r2BucketName],
  ]
    .filter(([, value]) => !value)
    .map(([field]) => field)

  if (!env.r2Endpoint && !env.r2AccountId) {
    missingFields.push("R2_ENDPOINT or R2_ACCOUNT_ID")
  }

  if (env.r2UsePublicCdn && !env.r2PublicUrl) {
    missingFields.push("R2_PUBLIC_URL")
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Invalid API environment: storage provider r2 requires ${missingFields.join(", ")}`,
    )
  }
}
