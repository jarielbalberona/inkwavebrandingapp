import type {
  DailyBusinessDigestEmailProps,
  LowStockAlertEmailProps,
} from "@workspace/emails"
import {
  renderDailyBusinessDigestEmail,
  renderLowStockAlertEmail,
} from "@workspace/emails/server"

import type { PreparedEmailMessage } from "./email.types.js"

export async function buildDailyBusinessDigestMessage(
  props: DailyBusinessDigestEmailProps,
): Promise<PreparedEmailMessage> {
  const rendered = await renderDailyBusinessDigestEmail(props)

  return {
    subject: `${props.businessName} daily digest · ${props.reportDateLabel}`,
    html: rendered.html,
    text: rendered.text,
  }
}

export async function buildLowStockAlertMessage(
  props: LowStockAlertEmailProps,
): Promise<PreparedEmailMessage> {
  const rendered = await renderLowStockAlertEmail(props)
  const outOfStockCount = props.items.filter((item) => item.status === "out").length
  const subjectPrefix = outOfStockCount > 0 ? "Critical stock alert" : "Low stock alert"

  return {
    subject: `${subjectPrefix} · ${props.businessName}`,
    html: rendered.html,
    text: rendered.text,
  }
}
