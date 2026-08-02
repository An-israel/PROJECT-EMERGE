/**
 * Currency formatting (section 7.4).
 *
 * `₦` followed by the integer amount with thousands separators and no decimals.
 * Naira is not subdivided in this campaign, so we always render whole Naira.
 */
export function formatNaira(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const abs = Math.abs(rounded);
  const grouped = abs.toLocaleString("en-NG", { maximumFractionDigits: 0 });
  return `${rounded < 0 ? "-" : ""}₦${grouped}`;
}

/** Format a `YYYY-MM-DD` date string in a warm, human-readable form. */
export function formatDate(dateISO: string): string {
  // Parse as a plain calendar date (avoid timezone shifting a bare date).
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!y || !m || !d) return dateISO;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
