import type { ApiEnv } from "./env.js"

export interface StorageConfig {
  provider: "none" | "r2"
  maxFileBytes: number
  maxRequestBytes: number
  r2: R2StorageConfig | null
}

export interface R2StorageConfig {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  endpoint: string
  publicUrl: string | null
  usePublicCdn: boolean
}

export function loadStorageConfig(env: ApiEnv): StorageConfig {
  if (env.storageProvider !== "r2") {
    return {
      provider: "none",
      maxFileBytes: env.uploadMaxFileBytes,
      maxRequestBytes: env.uploadMaxRequestBytes,
      r2: null,
    }
  }

  const accountId = requireValue(env.r2AccountId, "R2_ACCOUNT_ID")
  const accessKeyId = requireValue(env.r2AccessKeyId, "R2_ACCESS_KEY_ID")
  const secretAccessKey = requireValue(env.r2SecretAccessKey, "R2_SECRET_ACCESS_KEY")
  const bucketName = requireValue(env.r2BucketName, "R2_BUCKET_NAME")
  const endpoint = env.r2Endpoint?.trim() || `https://${accountId}.r2.cloudflarestorage.com`
  const publicUrl = env.r2UsePublicCdn ? requireValue(env.r2PublicUrl, "R2_PUBLIC_URL") : null

  return {
    provider: "r2",
    maxFileBytes: env.uploadMaxFileBytes,
    maxRequestBytes: env.uploadMaxRequestBytes,
    r2: {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      endpoint,
      publicUrl,
      usePublicCdn: env.r2UsePublicCdn,
    },
  }
}

function requireValue(value: string | undefined, fieldName: string) {
  if (!value) {
    throw new Error(`Invalid API environment: ${fieldName} is required`)
  }

  return value
}
