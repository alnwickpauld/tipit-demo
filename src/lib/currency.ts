export function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function amountToMinorUnits(amount: number) {
  return Math.round(amount * 100);
}
