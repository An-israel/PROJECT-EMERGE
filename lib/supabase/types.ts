/**
 * Hand-written database types. Kept small and focused on what the app reads.
 */
import type {
  Tier,
  Plan,
  ReceiptStatus,
  PartnershipStatus,
  Role,
  ContactMethod,
} from "@/lib/constants";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  show_on_honor_roll: boolean;
  honor_roll_name: string | null;
  created_at: string;
}

export interface Partnership {
  id: string;
  partner_id: string;
  tier: Tier;
  amount: number;
  plan: Plan;
  start_date: string;
  status: PartnershipStatus;
  created_at: string;
}

export interface Installment {
  id: string;
  partnership_id: string;
  sequence: number;
  due_date: string;
  amount: number;
  created_at: string;
}

export interface Receipt {
  id: string;
  partner_id: string;
  partnership_id: string;
  amount: number;
  transfer_date: string;
  reference: string | null;
  file_path: string;
  note: string | null;
  status: ReceiptStatus;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ContactLog {
  id: string;
  partner_id: string;
  admin_id: string;
  method: ContactMethod;
  note: string | null;
  created_at: string;
}

export interface Settings {
  id: number;
  campaign_title: string;
  campaign_subtitle: string;
  scripture: string;
  goal: number;
  currency_symbol: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_name: string;
  one_time_grace_days: number;
  monthly_interval_months: number;
  behind_grace_days: number;
  updated_at: string;
}

export type PublicSettings = Omit<Settings, "id" | "goal" | "updated_at">;
