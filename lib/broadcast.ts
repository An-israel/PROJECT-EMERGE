/**
 * Broadcast email: audiences, personalisation, and plain-text → HTML.
 *
 * Pure on purpose — the admin UI shows recipient counts and a live preview
 * from the same functions the server action sends with, and every rule here
 * is unit tested without a database.
 */
import type { DerivedStatus, Role } from "@/lib/constants";
import { toE164 } from "@/lib/phone";

/** A broadcast goes out over one channel at a time. */
export const BROADCAST_CHANNELS = ["email", "sms"] as const;
export type BroadcastChannel = (typeof BROADCAST_CHANNELS)[number];

export const BROADCAST_AUDIENCES = [
  "all",
  "partners",
  "admins",
  "behind",
  "on_track",
  "completed",
] as const;

export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  all: "Everyone registered",
  partners: "Partners only",
  admins: "Admins only",
  behind: "Partners who are behind",
  on_track: "Partners on track",
  completed: "Partners who have completed",
};

export const AUDIENCE_HINTS: Record<BroadcastAudience, string> = {
  all: "Every registered user — partners and admins.",
  partners: "Everyone with a partner account.",
  admins: "Your admin team only. Useful for a dry run.",
  behind: "Partners behind their plan today. A gentle nudge, not a demand.",
  on_track: "Partners keeping up with their plan.",
  completed: "Partners who have paid their partnership in full.",
};

/** One addressable person, flattened from a profile + their progress. */
export interface BroadcastRecipient {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  /** Derived partnership status, or null for a user with no partnership. */
  status: DerivedStatus | null;
  /** Opted out of email announcements (receipt mail still reaches them). */
  emailOptOut: boolean;
  /** Opted out of SMS announcements. */
  smsOptOut: boolean;
}

/** Maximum messages per Resend batch call. */
export const BROADCAST_BATCH_SIZE = 100;

export const MAX_SUBJECT_LENGTH = 120;
export const MAX_BODY_LENGTH = 5000;

/** Roughly three GSM-7 parts. Longer costs more and reads worse on a phone. */
export const MAX_SMS_LENGTH = 480;

/**
 * Who actually receives a broadcast: the audience filter, minus anyone who
 * opted out of this channel or has no usable address, de-duplicated so one
 * person on two accounts is never messaged twice.
 */
export function selectRecipients(
  people: BroadcastRecipient[],
  audience: BroadcastAudience,
  channel: BroadcastChannel = "email",
): BroadcastRecipient[] {
  const seen = new Set<string>();
  const chosen: BroadcastRecipient[] = [];

  for (const person of people) {
    if (!matchesAudience(person, audience)) continue;

    const key = reachableKey(person, channel);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    chosen.push(person);
  }

  return chosen;
}

/**
 * The de-duplication key for a channel — an email address or a canonical
 * phone number — or null when this person cannot be reached on it.
 */
function reachableKey(
  person: BroadcastRecipient,
  channel: BroadcastChannel,
): string | null {
  if (channel === "sms") {
    if (person.smsOptOut) return null;
    // Key on the canonical number, so 0803… and +234803… are one person.
    return toE164(person.phone);
  }
  if (person.emailOptOut) return null;
  const email = person.email?.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

/** Does this person belong to the audience, ignoring reachability? */
export function matchesAudience(
  person: BroadcastRecipient,
  audience: BroadcastAudience,
): boolean {
  switch (audience) {
    case "all":
      return true;
    case "partners":
      return person.role === "partner";
    case "admins":
      return person.role === "admin";
    case "behind":
    case "on_track":
    case "completed":
      return person.role === "partner" && person.status === audience;
  }
}

/** Recipient count for every audience on one channel, for the picker. */
export function audienceCounts(
  people: BroadcastRecipient[],
  channel: BroadcastChannel = "email",
): Record<BroadcastAudience, number> {
  const counts = {} as Record<BroadcastAudience, number>;
  for (const audience of BROADCAST_AUDIENCES) {
    counts[audience] = selectRecipients(people, audience, channel).length;
  }
  return counts;
}

/** First word of a name, for `{{first_name}}`. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/**
 * Replace the personalisation tokens an admin can type. Unknown tokens are
 * left exactly as written so a typo is visible rather than silently blank.
 */
export function personalize(
  text: string,
  person: { name: string },
): string {
  return text
    .replace(/\{\{\s*name\s*\}\}/gi, person.name)
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName(person.name));
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Admins write plain text. Blank lines become paragraphs, single newlines
 * become line breaks, and everything is escaped — no HTML is ever accepted
 * from the compose box.
 */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 14px;">${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
}

/** Split a list into fixed-size chunks (batched sending). */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
