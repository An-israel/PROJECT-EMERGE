import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CAMPAIGN } from "@/lib/constants";
import type { PublicSettings, Settings } from "@/lib/supabase/types";

/**
 * Public/partner-safe settings (bank + campaign copy, NEVER the goal).
 * Read from the `public_settings` view. Falls back to seeded constants so the
 * landing page still renders if the DB is unreachable during local dev.
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("public_settings")
      .select("*")
      .single();
    if (data) return data as PublicSettings;
  } catch {
    // fall through to defaults
  }
  return {
    campaign_title: CAMPAIGN.title,
    campaign_subtitle: CAMPAIGN.subtitle,
    scripture: CAMPAIGN.scripture,
    currency_symbol: CAMPAIGN.currencySymbol,
    bank_account_name: CAMPAIGN.bankAccountName,
    bank_account_number: CAMPAIGN.bankAccountNumber,
    bank_name: CAMPAIGN.bankName,
    one_time_grace_days: CAMPAIGN.oneTimeGraceDays,
    monthly_interval_months: CAMPAIGN.monthlyIntervalMonths,
    behind_grace_days: CAMPAIGN.behindGraceDays,
  };
}

/**
 * Full settings including the goal. ADMIN SERVER CODE ONLY — reads via the
 * service role. Never call this from a partner-facing route.
 */
export async function getFullSettings(): Promise<Settings> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) {
    // Seeded defaults, so admin pages still work pre-seed.
    return {
      id: 1,
      campaign_title: CAMPAIGN.title,
      campaign_subtitle: CAMPAIGN.subtitle,
      scripture: CAMPAIGN.scripture,
      goal: CAMPAIGN.goal,
      currency_symbol: CAMPAIGN.currencySymbol,
      bank_account_name: CAMPAIGN.bankAccountName,
      bank_account_number: CAMPAIGN.bankAccountNumber,
      bank_name: CAMPAIGN.bankName,
      one_time_grace_days: CAMPAIGN.oneTimeGraceDays,
      monthly_interval_months: CAMPAIGN.monthlyIntervalMonths,
      behind_grace_days: CAMPAIGN.behindGraceDays,
      updated_at: new Date().toISOString(),
    };
  }
  return data as Settings;
}
