// Sum integer minor units so decimal currency values do not accumulate float errors.
export function serviceValue(bookings, statuses) {
  return bookings.filter(a => statuses.includes(a.status)).reduce((total, a) => {
    const raw = String(a.service_price ?? "");
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return total;
    const [whole, fraction = ""] = raw.split(".");
    return total + Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  }, 0);
}
export function formatJod(minorUnits) {
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minorUnits / 100) + " JOD";
}
