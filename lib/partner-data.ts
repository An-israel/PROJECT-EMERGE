import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeProgress, installmentRowStates } from "@/lib/progress";
import { todayInCampaignTZ } from "@/lib/time";
import type {
  Partnership,
  Installment,
  Receipt,
} from "@/lib/supabase/types";

export interface PartnerDashboardData {
  partnership: Partnership | null;
  installments: Installment[];
  receipts: Receipt[];
  progress: ReturnType<typeof computeProgress> | null;
  rowStates: ReturnType<typeof installmentRowStates>;
  behindGraceDays: number;
}

/**
 * Loads the signed-in partner's own partnership + schedule + receipts and
 * computes progress. All reads go through the user's session client, so RLS
 * guarantees a partner only ever sees their own data.
 */
export async function getPartnerDashboard(
  partnerId: string,
  behindGraceDays: number,
): Promise<PartnerDashboardData> {
  const supabase = await createClient();

  const { data: partnership } = await supabase
    .from("partnerships")
    .select("*")
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (!partnership) {
    return {
      partnership: null,
      installments: [],
      receipts: [],
      progress: null,
      rowStates: [],
      behindGraceDays,
    };
  }

  const [{ data: installments }, { data: receipts }] = await Promise.all([
    supabase
      .from("installments")
      .select("*")
      .eq("partnership_id", partnership.id)
      .order("sequence", { ascending: true }),
    supabase
      .from("receipts")
      .select("*")
      .eq("partnership_id", partnership.id)
      .order("created_at", { ascending: false }),
  ]);

  const today = todayInCampaignTZ();
  const installmentList = (installments ?? []) as Installment[];
  const receiptList = (receipts ?? []) as Receipt[];

  const progress = computeProgress({
    amount: Number(partnership.amount),
    receipts: receiptList.map((r) => ({
      amount: Number(r.amount),
      status: r.status,
    })),
    installments: installmentList.map((i) => ({
      sequence: i.sequence,
      dueDate: i.due_date,
      amount: Number(i.amount),
    })),
    today,
    behindGraceDays,
  });

  const rowStates = installmentRowStates(
    installmentList.map((i) => ({
      sequence: i.sequence,
      dueDate: i.due_date,
      amount: Number(i.amount),
    })),
    progress.verifiedTotal,
    today,
    behindGraceDays,
  );

  return {
    partnership: partnership as Partnership,
    installments: installmentList,
    receipts: receiptList,
    progress,
    rowStates,
    behindGraceDays,
  };
}
