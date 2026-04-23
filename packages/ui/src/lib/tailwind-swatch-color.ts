import colors from "tailwindcss/colors"

/**
 * Resolves a Tailwind v4 default palette value (e.g. orange-500) for use in inline
 * styles. Theme CSS variables like `--color-orange-500` are only emitted when a
 * utility references them, so `var(--color-… )` in inline styles often resolves
 * to nothing in production.
 */
export function getTailwindDefaultSwatch(
  name: string,
  step: string
): string | undefined {
  const group = colors[name as keyof typeof colors]
  if (group && typeof group === "object" && !Array.isArray(group) && step in group) {
    return (group as Record<string, string>)[step]
  }
  return undefined
}
