export const conversionFactor = 1000;

export function cleanNumber(
  val: string | number | null | undefined,
  allowNegative = false
): string | number | undefined {
  if (val === null || val === undefined || val === "") {
    return undefined;
  }

  if (typeof val === "number") {
    return val;
  }

  const strVal = val.toString().trim();
  const cleaned = allowNegative ? strVal.replace(/[^\d-.]/g, "") : strVal.replace(/[^\d.]/g, "");

  // Handle negative sign at the start only
  if (allowNegative && cleaned.startsWith("-")) {
    const parts = cleaned.split("-");
    if (parts.length > 2) {
      return `-${parts.slice(1).join("")}`;
    }
  }

  return cleaned;
}

export type Currency = "PHP" | "USD" | "EUR";

/**
 * Create a currency formatter for the specified currency
 */
export function createCurrencyFormatter(currency: Currency): Intl.NumberFormat {
  const locale =
    currency === "PHP" ? "en-PH" : currency === "EUR" ? "de-DE" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Default PHP formatter for backward compatibility
export const currencyFormatter = createCurrencyFormatter("PHP");

/**
 * Format a currency amount with the specified currency
 */
export function formatCurrency(amount: number, currency: Currency = "PHP"): string {
  const formatter = createCurrencyFormatter(currency);
  return formatter.format(amount);
}

export function displayAmount(
  value: number | string | undefined,
  displayAbsolute = false,
  currency: Currency = "PHP"
): string {
  if (value === undefined) {
    return "–";
  }

  let amount = 0;
  if (typeof value === "string") {
    amount = Number(value);
  } else if (typeof value === "number") {
    amount = value;
  }

  // Handle NaN
  if (isNaN(amount)) {
    return "–";
  }

  amount = displayAbsolute ? Math.abs(amount) : amount;
  const formatter = createCurrencyFormatter(currency);

  if (amount < 0) {
    return `(${formatter.format(Math.abs(amount))})`;
  } else {
    return formatter.format(amount);
  }
}
