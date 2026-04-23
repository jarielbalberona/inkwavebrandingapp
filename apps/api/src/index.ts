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
export { CupsRepository } from "./modules/cups/cups.repository.js"
export { CupsService } from "./modules/cups/cups.service.js"
export type { AdminCupDto, CupDto, StaffCupDto } from "./modules/cups/cups.types.js"
export {
  calculateAvailable,
  getMovementDelta,
  inventoryMovementDeltas,
  inventoryMovementTypes,
} from "./modules/inventory/inventory.rules.js"
export type { InventoryBalanceDelta, InventoryMovementType } from "./modules/inventory/inventory.rules.js"
export { InventoryRepository } from "./modules/inventory/inventory.repository.js"
export { handleInventoryRoute } from "./modules/inventory/inventory.routes.js"
export { InventoryService } from "./modules/inventory/inventory.service.js"
export type { InventoryBalanceDto } from "./modules/inventory/inventory.types.js"
export type { InventoryMovementDto } from "./modules/inventory/inventory.movement-types.js"
export { hashPassword, verifyPassword } from "./modules/users/passwords.js"
export { UsersRepository } from "./modules/users/users.repository.js"
