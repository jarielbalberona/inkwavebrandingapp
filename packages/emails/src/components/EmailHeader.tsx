import { Section, Text } from "@react-email/components"
import * as React from "react"

import {
  defaultEmailBranding,
  type EmailBranding,
} from "../brand.js"

export interface EmailHeaderProps {
  branding?: Partial<EmailBranding>
  eyebrow?: string
}

export function EmailHeader({ branding, eyebrow = "Operational Email" }: EmailHeaderProps) {
  const resolvedBranding = { ...defaultEmailBranding, ...branding }

  return (
    <Section className="mb-8">
      <Text className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
        {eyebrow}
      </Text>
      <Text className="m-0 text-[28px] font-semibold leading-none text-foreground">
        {resolvedBranding.companyName}
      </Text>
      <Text className="m-0 mt-2 text-sm leading-6 text-muted-foreground">
        {resolvedBranding.appName}
      </Text>
    </Section>
  )
}
