/**
 * Server-side "today" in campaign time (Africa/Lagos), section 10.
 *
 * All due-date and behind-schedule math is anchored to Lagos time so a browser
 * or server in another timezone can never shift a due date. Lagos is a fixed
 * UTC+1 offset (no DST), but we resolve it via Intl to stay correct if that
 * ever changes.
 */
import { CAMPAIGN_TIMEZONE } from "./constants";
import type { ISODate } from "./date";

export function todayInCampaignTZ(now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPAIGN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
