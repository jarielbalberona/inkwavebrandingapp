import { render } from "@react-email/render"
import type * as React from "react"

import {
  DailyBusinessDigestEmail,
  type DailyBusinessDigestEmailProps,
} from "../templates/DailyBusinessDigestEmail.js"
import {
  LowStockAlertEmail,
  type LowStockAlertEmailProps,
} from "../templates/LowStockAlertEmail.js"

export interface RenderedEmail {
  html: string
  text: string
}

export async function renderEmailTemplate(
  element: React.ReactElement,
): Promise<RenderedEmail> {
  const html = await render(element)

  return {
    html,
    text: htmlToPlainText(html),
  }
}

export function renderDailyBusinessDigestEmail(
  props: DailyBusinessDigestEmailProps,
) {
  return renderEmailTemplate(<DailyBusinessDigestEmail {...props} />)
}

export function renderLowStockAlertEmail(props: LowStockAlertEmailProps) {
  return renderEmailTemplate(<LowStockAlertEmail {...props} />)
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<\/(p|div|li|tr|h1|h2|h3|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
