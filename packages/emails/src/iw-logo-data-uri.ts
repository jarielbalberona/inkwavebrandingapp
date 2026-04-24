import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * `packages/emails/src/iw-logo.jpg` inlined for `<Img src>` so outbound mail does
 * not depend on a public URL. Built output expects `dist/iw-logo.jpg` (see
 * package `build` script) when loading from `dist/`.
 */
const logoPath = join(dirname(fileURLToPath(import.meta.url)), "iw-logo.jpg")
const base64 = readFileSync(logoPath).toString("base64")

export const IW_LOGO_DATA_URI = `data:image/jpeg;base64,${base64}` as const
