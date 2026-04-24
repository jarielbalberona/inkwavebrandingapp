import { createApiServer } from "./app.js"
import { loadApiEnv } from "./config/env.js"
import { loadStorageConfig } from "./config/storage.js"
import { initSentry } from "./instrumentation/sentry.js"
import { logInfo } from "./lib/logger.js"

const env = loadApiEnv()

if (!env.authSessionSecret) {
  throw new Error("Invalid API environment: AUTH_SESSION_SECRET is required")
}

const runtimeEnv = {
  ...env,
  authSessionSecret: env.authSessionSecret,
}

const storageConfig = loadStorageConfig(env)

initSentry()

const server = createApiServer(runtimeEnv)

server.listen(env.port, () => {
  logInfo({
    event: "api_server_started",
    nodeEnv: env.nodeEnv,
    port: env.port,
    databaseConfigured: Boolean(
      env.databaseUrl ||
        (env.databaseHost &&
          env.databaseUser &&
          env.databasePassword &&
          env.databaseName),
    ),
    sentryEnabled: Boolean(env.sentryDsn),
    storageProvider: storageConfig.provider,
    storagePublicUrlConfigured: Boolean(storageConfig.r2?.publicUrl),
    webOriginConfigured: Boolean(env.webOrigin),
  })
})
