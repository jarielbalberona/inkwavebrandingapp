import { Section, Text } from "@react-email/components"
import * as React from "react"

export interface MetricCardProps {
  label: string
  value: string
  tone?: "default" | "critical"
}

export function MetricCard({
  label,
  value,
  tone = "default",
}: MetricCardProps) {
  const valueClassName =
    tone === "critical" ? "text-destructive" : "text-foreground"

  return (
    <Section className="rounded-lg border border-border bg-card p-4">
      <Text className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </Text>
      <Text className={`m-0 mt-2 text-[26px] font-semibold ${valueClassName}`}>
        {value}
      </Text>
    </Section>
  )
}
