import {
  Body,
  Container,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components"
import * as React from "react"

import { type EmailBranding } from "../brand.js"
import { emailThemeConfig } from "../theme.js"
import { EmailFooter } from "./EmailFooter.js"
import { EmailHead } from "./EmailHead.js"
import { EmailHeader } from "./EmailHeader.js"

export interface EmailShellProps {
  previewText: string
  heading: string
  subheading?: string
  eyebrow?: string
  branding?: Partial<EmailBranding>
  footerNote?: string
  helpUrl?: string
  children: React.ReactNode
}

export function EmailShell({
  previewText,
  heading,
  subheading,
  eyebrow,
  branding,
  footerNote,
  helpUrl,
  children,
}: EmailShellProps) {
  return (
    <Html>
      <EmailHead />
      <Preview>{previewText}</Preview>
      <Tailwind config={emailThemeConfig}>
        <Body className="bg-background font-sans py-8">
          <Container className="mx-auto max-w-[640px] rounded-xl border border-border bg-card px-8 py-8">
            <EmailHeader branding={branding} eyebrow={eyebrow} />

            <Section className="mb-8 border-b border-border pb-6">
              <Text className="m-0 font-heading text-[32px] leading-[1.15] text-foreground">
                {heading}
              </Text>
              {subheading ? (
                <Text className="m-0 mt-3 text-[15px] leading-7 text-muted-foreground">
                  {subheading}
                </Text>
              ) : null}
            </Section>

            {children}

            <EmailFooter
              branding={branding}
              footerNote={footerNote}
              helpUrl={helpUrl}
            />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
