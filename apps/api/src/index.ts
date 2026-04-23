export {
  apiEnvSchema,
  loadApiEnv,
  loadDatabaseEnv,
  parseApiEnv,
} from "./config/env.js"
export { createDatabaseClient, getDatabaseClient } from "./db/client.js"
export type { DatabaseClient } from "./db/client.js"
export { createDatabasePool, getDatabasePool } from "./db/pool.js"
export { initSentry } from "./instrumentation/sentry.js"
export { createOpenAIClient } from "./lib/openai.js"
export { routeDefinitions } from "./http/routes.js"
export {
  authenticateRequest,
  requireAuthenticatedRequest,
  sendUnauthenticated,
} from "./modules/auth/auth.middleware.js"
export type { AuthenticatedRequestContext } from "./modules/auth/auth.middleware.js"
export {
  AuthorizationError,
  assertAdmin,
  assertCanViewConfidentialFields,
  canViewConfidentialFields,
  confidentialFieldCategories,
  isAdmin,
  roleFromUnknown,
  sendForbidden,
} from "./modules/auth/authorization.js"
export type { ConfidentialFieldCategory } from "./modules/auth/authorization.js"
export {
  assertNoStaffRestrictedKeys,
  findStaffRestrictedKeys,
  shapeRoleAwareResponse,
  staffRestrictedResponseKeys,
} from "./modules/auth/role-safe-response.js"
export type { StaffRestrictedResponseKey } from "./modules/auth/role-safe-response.js"
export { AuthService, AuthenticationError } from "./modules/auth/auth.service.js"
export { createSessionToken, verifySessionToken } from "./modules/auth/sessions.js"
export { hashPassword, verifyPassword } from "./modules/users/passwords.js"
export { UsersRepository } from "./modules/users/users.repository.js"
