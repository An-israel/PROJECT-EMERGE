/**
 * Campaign constants (section 3 of the build spec).
 *
 * These are the initial/default values. At runtime the admin-editable copy
 * lives in the `settings` table; this module is the single source of truth for
 * seeding that row and for typing tiers/plans across the app.
 */

export const CAMPAIGN = {
  title: "Project Emerge",
  subtitle: "Building Together. Rising Visibly.",
  scripture: "Haggai 1:8",
  goal: 100_000_000,
  currencySymbol: "₦",
  bankAccountName: "IdealLife Global City Outreach - Project",
  bankAccountNumber: "4005900458",
  bankName: "Moniepoint",
  oneTimeGraceDays: 30,
  monthlyIntervalMonths: 1,
  behindGraceDays: 3,
} as const;

export const SETTINGS_ROW_ID = 1;

/** Default long-form landing copy (admin-editable; these are the fallbacks). */
export const DEFAULT_HERO_BODY =
  "We are building a permanent tent and securing land for the work ahead. This is our house, rising in our time, built by our hands together.";
export const DEFAULT_VISION_BODY =
  "Phase One of Project Emerge is focused and clear. We are raising the funds to build our tent and to lease and acquire landed property for Ideal Life City. Every partnership, at every level, moves this building from vision to ground. You are not giving to a project. You are building a house that will stand.";

/** Fixed timezone for all "today"/due-date math (Nigeria). */
export const CAMPAIGN_TIMEZONE = "Africa/Lagos";

// ---- Tiers -----------------------------------------------------------------

// Ordered largest to smallest so every tier list (landing cards, sign-up
// dropdown, filters) shows the biggest partnership first.
export const TIERS = [
  "2000000_plus",
  "1000000",
  "500000",
  "300000",
  "200000",
  "100000",
] as const;

export type Tier = (typeof TIERS)[number];

/** Minimum amount for the open-ended top tier. */
export const CUSTOM_TIER_MINIMUM = 2_000_000;

/** Numeric amount implied by a tier, or null for the custom tier. */
export function tierBaseAmount(tier: Tier): number | null {
  if (tier === "2000000_plus") return null;
  return Number(tier);
}

export const TIER_LABELS: Record<Tier, string> = {
  "100000": "₦100,000",
  "200000": "₦200,000",
  "300000": "₦300,000",
  "500000": "₦500,000",
  "1000000": "₦1,000,000",
  "2000000_plus": "₦2,000,000 and above",
};

// ---- Plans -----------------------------------------------------------------

export const PLANS = [
  "one_time",
  "three_months",
  "six_months",
  "ten_months",
] as const;

export type Plan = (typeof PLANS)[number];

export const PLAN_LABELS: Record<Plan, string> = {
  one_time: "One Time Payment",
  three_months: "3 Months Installment",
  six_months: "6 Months Installment",
  ten_months: "10 Months Installment",
};

/** Number of installments implied by a plan. */
export const PLAN_INSTALLMENTS: Record<Plan, number> = {
  one_time: 1,
  three_months: 3,
  six_months: 6,
  ten_months: 10,
};

// ---- Domain enums ----------------------------------------------------------

export type ReceiptStatus = "pending" | "approved" | "rejected";
export type PartnershipStatus = "active" | "completed" | "cancelled";
export type Role = "partner" | "admin";
export type DerivedStatus = "on_track" | "behind" | "completed";
export type ContactMethod = "phone" | "email" | "whatsapp" | "other";
