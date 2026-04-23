import * as Sentry from "@sentry/node"

import { loadApiEnv } from "../config/env.js"

export interface SentryInitializationResult {
  enabled: boolean
  reason?: string
}

export function initSentry(): SentryInitializationResult {
  const env = loadApiEnv()

  if (!env.sentryDsn) {
    return {
      enabled: false,
      reason: "SENTRY_DSN is not configured",
    }
  }

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    tracesSampleRate: env.sentryTracesSampleRate,
  })

  return {
    enabled: true,
  }
}

export { Sentry }
