import { Column, Img, Row, Section, Text } from "@react-email/components"

import {
  defaultEmailBranding,
  type EmailBranding,
} from "../brand.js"
import { IW_LOGO_DATA_URI } from "../iw-logo-data-uri.js"

export interface EmailHeaderProps {
  branding?: Partial<EmailBranding>
  eyebrow?: string
  /** When set, used instead of the bundled `iw-logo.jpg` (e.g. absolute CDN URL). */
  logoSrc?: string
}

export function EmailHeader({ branding, eyebrow = "Operational Email", logoSrc }: EmailHeaderProps) {
  const resolvedBranding = { ...defaultEmailBranding, ...branding }
  const resolvedLogo = logoSrc ?? IW_LOGO_DATA_URI

  return (
    <Section className="mb-8">
      <Row>
        <Column className="w-[120px] pr-3 align-top">
          <Img
            alt={resolvedBranding.companyName}
            className="m-0 block h-[40px] w-[120px] object-contain"
            height={40}
            src={resolvedLogo}
            width={120}
          />
        </Column>
        <Column className="align-top">
          <Text className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
            {eyebrow}
          </Text>
          <Text className="m-0 text-[28px] font-semibold leading-none text-foreground">
            {resolvedBranding.companyName}
          </Text>
          <Text className="m-0 mt-2 text-sm leading-6 text-muted-foreground">
            {resolvedBranding.appName}
          </Text>
        </Column>
      </Row>
    </Section>
  )
}
