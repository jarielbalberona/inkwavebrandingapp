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

/** Password may contain URL-reserved characters; only trim outer whitespace and stray newlines from paste. */
const optionalDatabasePassword = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return value
  }
  if (typeof value !== "string") {
    return value
  }
  const s = value.replaceAll(/\r|\n/g, "").trim()
  return s === "" ? undefined : s
}, z.string().min(1).optional())

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
  /** When set together with user/password/name, used instead of DATABASE_URL (password can contain @, #, etc.). */
  DATABASE_HOST: optionalNonEmptyString,
  DATABASE_USER: optionalNonEmptyString,
  DATABASE_PASSWORD: optionalDatabasePassword,
  DATABASE_NAME: optionalNonEmptyString,
  DATABASE_PORT: z.preprocess(
    (value) =>
      value === undefined || value === null || value === "" ? undefined : value,
    z.coerce.number().int().positive().default(5432),
  ),
  DATABASE_SSL_MODE: z.enum(["disable", "require"]).default("disable"),
  AUTH_SESSION_SECRET: optionalSessionSecret,
  /** `lax` (default in dev) or `none`+Secure for credentialed cross-origin (typical production SPA on another host). */
  AUTH_SESSION_SAME_SITE: z.enum(["lax", "strict", "none"]).optional(),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 8),
  /** Comma-separated browser origins for credentialed CORS (first entry is used for email dashboard links). */
  WEB_ORIGIN: optionalNonEmptyString,
  SENTRY_DSN: optionalNonEmptyString,
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  OPENAI_API_KEY: optionalNonEmptyString,
  EMAIL_PROVIDER: z.enum(["none", "resend"]).default("none"),
  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: optionalNonEmptyString,
  RESEND_REPLY_TO_EMAIL: optionalNonEmptyString,
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

export type AuthSessionSameSite = "Lax" | "Strict" | "None"

export function parseWebOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return []
  }

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function mapAuthSessionSameSite(
  raw: ParsedApiEnv["AUTH_SESSION_SAME_SITE"],
  nodeEnv: ParsedApiEnv["NODE_ENV"],
): AuthSessionSameSite {
  if (raw === "lax") {
    return "Lax"
  }
  if (raw === "strict") {
    return "Strict"
  }
  if (raw === "none") {
    return "None"
  }
  return nodeEnv === "production" ? "None" : "Lax"
}

export interface ApiEnv {
  nodeEnv: ParsedApiEnv["NODE_ENV"]
  port: number
  databaseUrl?: string
  databaseHost?: string
  databaseUser?: string
  databasePassword?: string
  databaseName?: string
  databasePort: number
  databaseSslMode: DatabaseSslMode
  authSessionSecret?: string
  authSessionSameSite: AuthSessionSameSite
  authSessionTtlSeconds: number
  /** First `WEB_ORIGIN` entry; used for absolute links (e.g. digest emails). */
  webOrigin?: string
  /** Parsed `WEB_ORIGIN` list (comma-separated); CORS allows any of these. */
  webOrigins: string[]
  sentryDsn?: string
  sentryTracesSampleRate: number
  openaiApiKey?: string
  emailProvider: ParsedApiEnv["EMAIL_PROVIDER"]
  resendApiKey?: string
  resendFromEmail?: string
  resendReplyToEmail?: string
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

export type DatabaseEnv =
  | {
      kind: "url"
      databaseUrl: string
      databaseSslMode: DatabaseSslMode
    }
  | {
      kind: "params"
      host: string
      port: number
      user: string
      password: string
      database: string
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

  const webOrigins = parseWebOrigins(result.data.WEB_ORIGIN)

  const env = {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    databaseUrl: result.data.DATABASE_URL,
    databaseHost: result.data.DATABASE_HOST,
    databaseUser: result.data.DATABASE_USER,
    databasePassword: result.data.DATABASE_PASSWORD,
    databaseName: result.data.DATABASE_NAME,
    databasePort: result.data.DATABASE_PORT,
    databaseSslMode: result.data.DATABASE_SSL_MODE,
    authSessionSecret: result.data.AUTH_SESSION_SECRET,
    authSessionSameSite: mapAuthSessionSameSite(
      result.data.AUTH_SESSION_SAME_SITE,
      result.data.NODE_ENV,
    ),
    authSessionTtlSeconds: result.data.AUTH_SESSION_TTL_SECONDS,
    webOrigins,
    webOrigin: webOrigins[0],
    sentryDsn: result.data.SENTRY_DSN,
    sentryTracesSampleRate: result.data.SENTRY_TRACES_SAMPLE_RATE,
    openaiApiKey: result.data.OPENAI_API_KEY,
    emailProvider: result.data.EMAIL_PROVIDER,
    resendApiKey: result.data.RESEND_API_KEY,
    resendFromEmail: result.data.RESEND_FROM_EMAIL,
    resendReplyToEmail: result.data.RESEND_REPLY_TO_EMAIL,
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
  validateEmailEnv(env)

  return env
}

export function loadApiEnv(): ApiEnv {
  ensureApiDotenv()
  return parseApiEnv(process.env)
}

export function loadDatabaseEnv(): DatabaseEnv {
  const env = loadApiEnv()

  const paramsComplete = Boolean(
    env.databaseHost &&
      env.databaseUser &&
      env.databasePassword &&
      env.databaseName,
  )

  if (paramsComplete) {
    return {
      kind: "params",
      host: env.databaseHost!,
      port: env.databasePort,
      user: env.databaseUser!,
      password: env.databasePassword!,
      database: env.databaseName!,
      databaseSslMode: env.databaseSslMode,
    }
  }

  if (!env.databaseUrl) {
    throw new Error(
      "Invalid API environment: set DATABASE_URL or all of DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME",
    )
  }

  try {
    parsePgConnectionString(env.databaseUrl)
  } catch {
    throw new Error(
      "Invalid API environment: DATABASE_URL is not a valid PostgreSQL connection URL. " +
        "Set DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME (and optional DATABASE_PORT) instead when the password contains @ or other URL-reserved characters, or percent-encode those characters in DATABASE_URL.",
    )
  }

  return {
    kind: "url",
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

function validateEmailEnv(env: ApiEnv) {
  if (env.emailProvider !== "resend") {
    return
  }

  const missingFields = [
    ["RESEND_API_KEY", env.resendApiKey],
    ["RESEND_FROM_EMAIL", env.resendFromEmail],
  ]
    .filter(([, value]) => !value)
    .map(([field]) => field)

  if (missingFields.length > 0) {
    throw new Error(
      `Invalid API environment: email provider resend requires ${missingFields.join(", ")}`,
    )
  }
}
