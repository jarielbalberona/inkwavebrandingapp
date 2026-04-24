export function formatMoney(value: string) {

  const numeric = Number(value)

  if (Number.isNaN(numeric)) {
    return value
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    currencyDisplay: "code",
  }).format(numeric)
}
