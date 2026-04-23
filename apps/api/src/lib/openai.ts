import OpenAI from "openai"

import { loadApiEnv } from "../config/env.js"

export function createOpenAIClient(apiKey = loadApiEnv().openaiApiKey) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  return new OpenAI({
    apiKey,
  })
}
