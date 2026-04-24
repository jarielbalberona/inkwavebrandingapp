export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

export function formatCurrency(
  value: number,
  currency: string = "PHP",
  locale: string = "en-PH",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}
