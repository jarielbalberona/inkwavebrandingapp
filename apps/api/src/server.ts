import { createApiServer } from "./app.js"
import { loadApiEnv } from "./config/env.js"
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

initSentry()

const server = createApiServer(runtimeEnv)

server.listen(env.port, () => {
  logInfo({
    event: "api_server_started",
    nodeEnv: env.nodeEnv,
    port: env.port,
    databaseConfigured: Boolean(env.databaseUrl),
    sentryEnabled: Boolean(env.sentryDsn),
    webOriginConfigured: Boolean(env.webOrigin),
  })
})
