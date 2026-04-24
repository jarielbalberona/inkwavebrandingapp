export function formatMoney(value: string) {
  const normalized = value.replace(/\u00B1/g, "").trim()
  if (normalized === "") {
    return value
  }

  const numeric = Number(normalized)

  if (Number.isNaN(numeric)) {
    return value
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(numeric)
}
