import { fileURLToPath } from "node:url"

/**
 * Absolute path to the Ink Wave logo (same asset as `packages/emails/src/iw-logo.jpg`)
 * for `@react-pdf/renderer` `Image` `src` when rendering in Node.
 */
export const IW_LOGO_PATH = fileURLToPath(new URL("./iw-logo.jpg", import.meta.url))
