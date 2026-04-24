import type { StorageConfig } from "../../config/storage.js"
import type { ObjectStorageProvider } from "./object-storage.types.js"
import { R2ObjectStorageProvider } from "./providers/r2-object-storage.provider.js"

export function createObjectStorageProvider(config: StorageConfig): ObjectStorageProvider | null {
  if (config.provider === "r2" && config.r2) {
    return new R2ObjectStorageProvider(config.r2)
  }

  return null
}
