/**
 * Reading money the way people actually type it.
 *
 * A partner entering ₦200,000 types "200,000" — and `Number("200,000")` is
 * NaN, which surfaced to them as "Expected number, received nan". Amounts are
 * therefore parsed leniently everywhere a person can type one, and formatted
 * with separators as they type so the grouped form is both natural and valid.
 */

/** Characters people put in an amount that carry no numeric meaning. */
const NOISE = /[₦$£€\s  ,_']/g;

/**
 * A number from whatever was typed, or null when it genuinely is not one.
 * Accepts "200,000", "₦200,000", "200 000", "200000.50".
 */
export function parseAmountInput(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== "string") return null;

  const cleaned = raw.replace(NOISE, "");
  if (!cleaned) return null;
  // One optional sign, digits, one optional decimal part. Nothing else.
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(cleaned)) return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Group an amount for display while it is being typed: "200000" → "200,000".
 * Keeps at most two decimals and never fights the person mid-edit.
 */
export function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(NOISE, "").replace(/[^\d.]/g, "");
  if (!cleaned) return "";

  const [whole = "", ...rest] = cleaned.split(".");
  const trimmed = whole.replace(/^0+(?=\d)/, "");
  const grouped = trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (!cleaned.includes(".")) return grouped;
  const decimals = rest.join("").slice(0, 2);
  return `${grouped || "0"}.${decimals}`;
}
