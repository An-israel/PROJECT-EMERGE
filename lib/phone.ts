/**
 * Phone-number normalisation for SMS, and SMS message maths.
 *
 * Partners type their number however they like — `0803 123 4567`,
 * `+234 803 123 4567`, `234-803-123-4567`. Gateways want one canonical E.164
 * form. Pure and unit tested; the admin UI and the send path share it so the
 * count shown is the count that goes out.
 */

/** Nigeria. Bare local numbers are assumed to be from the campaign's country. */
export const DEFAULT_COUNTRY_CODE = "234";

/**
 * Convert a typed number to E.164 (`+2348031234567`), or null if it cannot be
 * one. Never guesses at a number that is too short or too long to dial.
 */
export function toE164(
  raw: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  if (!raw) return null;

  // Keep digits, and a leading + if one was typed.
  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // International access prefix: 00234... → 234...
  if (!hadPlus && digits.startsWith("00")) digits = digits.slice(2);

  if (!hadPlus) {
    if (digits.startsWith("0")) {
      // National form: 0803… → 234803…
      digits = countryCode + digits.replace(/^0+/, "");
    } else if (!digits.startsWith(countryCode)) {
      // Bare subscriber number: 803… → 234803…
      digits = countryCode + digits;
    }
  }

  // E.164 allows 8–15 digits including the country code.
  if (digits.length < 8 || digits.length > 15) return null;

  return `+${digits}`;
}

/** True when the number can be dialled. */
export function isDialable(
  raw: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): boolean {
  return toE164(raw, countryCode) !== null;
}

/**
 * Canonical, de-duplicated E.164 numbers from a list of typed ones, keeping
 * the original order. Unusable numbers are dropped.
 */
export function uniqueE164(
  numbers: Array<string | null | undefined>,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const number of numbers) {
    const e164 = toE164(number, countryCode);
    if (!e164 || seen.has(e164)) continue;
    seen.add(e164);
    out.push(e164);
  }
  return out;
}

// ---------------------------------------------------------------------------
// SMS message maths
// ---------------------------------------------------------------------------

/** Characters the GSM 03.38 basic alphabet covers. */
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
/** GSM extension characters — each costs two septets. */
const GSM_EXTENDED = "^{}\\[~]|€";

export function isGsm7(text: string): boolean {
  for (const char of text) {
    if (!GSM_BASIC.includes(char) && !GSM_EXTENDED.includes(char)) return false;
  }
  return true;
}

export interface SmsCost {
  /** Billable parts. A gateway charges per part, per recipient. */
  segments: number;
  /** Characters used, counting GSM extension characters as two. */
  characters: number;
  /** Characters still free in the current segment. */
  remaining: number;
  /** GSM-7 (160 per part) or UCS-2 (70 per part — emoji, curly quotes, ₦). */
  encoding: "GSM-7" | "UCS-2";
}

/**
 * What a message actually costs to send. An emoji or a curly quote flips the
 * whole message to UCS-2 and more than halves the per-segment allowance, so
 * the compose box shows this live.
 */
export function smsCost(text: string): SmsCost {
  const gsm = isGsm7(text);
  const encoding = gsm ? "GSM-7" : "UCS-2";

  let characters = 0;
  for (const char of text) {
    characters += gsm && GSM_EXTENDED.includes(char) ? 2 : 1;
  }

  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;

  if (characters === 0) {
    return { segments: 0, characters: 0, remaining: single, encoding };
  }
  if (characters <= single) {
    return {
      segments: 1,
      characters,
      remaining: single - characters,
      encoding,
    };
  }
  const segments = Math.ceil(characters / multi);
  return {
    segments,
    characters,
    remaining: segments * multi - characters,
    encoding,
  };
}
