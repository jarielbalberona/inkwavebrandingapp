/**
 * In development, default to same-origin `/api` so the Vite dev server can proxy
 * to the API. Session cookies then stay first-party, which matches strict Mobile
 * Safari / SameSite behavior for LAN testing. Set `VITE_API_BASE_URL` to a full
 * URL to call the API directly (cross-origin; may need `AUTH_SESSION_SAME_SITE=none`
 * on the API).
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (import.meta.env.DEV) {
    if (fromEnv !== undefined && fromEnv.length > 0) {
      return fromEnv
    }
    return "/api"
  }
  return fromEnv ?? "http://localhost:3000"
}
