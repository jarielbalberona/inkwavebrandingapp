import { formatCurrency } from "@workspace/ui/lib/number"

export function formatMoneyValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return formatCurrency(0)
  }

  const numericValue = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return formatCurrency(0)
  }

  return formatCurrency(numericValue)
}
