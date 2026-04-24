import { Text } from "@react-email/components"
import * as React from "react"

export interface StatusBadgeProps {
  label: string
  tone?: "neutral" | "warning" | "critical" | "positive"
}

export function StatusBadge({
  label,
  tone = "neutral",
}: StatusBadgeProps) {
  const className =
    tone === "critical"
      ? "bg-red-50 text-destructive border-red-200"
      : tone === "warning"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : tone === "positive"
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-muted text-muted-foreground border-border"

  return (
    <Text
      className={`m-0 inline-block rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${className}`}
    >
      {label}
    </Text>
  )
}
