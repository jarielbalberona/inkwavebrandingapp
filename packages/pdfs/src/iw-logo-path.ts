import { fileURLToPath } from "node:url"

/**
 * Absolute path to the Ink Wave logo (PDFs embed the file; emails use a public URL in `@workspace/emails` branding).
 * for `@react-pdf/renderer` `Image` `src` when rendering in Node.
 */
export const IW_LOGO_PATH = fileURLToPath(new URL("./iw-logo.jpg", import.meta.url))
