import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeProgress, computeAggregate } from "@/lib/progress";
import { todayInCampaignTZ } from "@/lib/time";
import { getFullSettings } from "@/lib/settings";
import type { BroadcastRecipient } from "@/lib/broadcast";
import type {
  Partnership,
  Installment,
  Receipt,
  Profile,
  ContactLog,
  Broadcast,
} from "@/lib/supabase/types";
import type { DerivedStatus } from "@/lib/constants";

export interface PartnerRow {
  profile: Profile;
  partnership: Partnership;
  verifiedTotal: number;
  pendingTotal: number;
  progressPct: number;
  remaining: number;
  behindBy: number;
  status: DerivedStatus;
}

interface OverviewData {
  aggregate: ReturnType<typeof computeAggregate>;
  goal: number;
  partners: PartnerRow[];
}

/**
 * Full admin overview. Runs with the service role (admin-only server code,
 * always behind requireAdmin()). Computes aggregate totals and per-partner
 * progress. These figures are never returned to a partner-facing route.
 */
export async function getAdminOverview(): Promise<OverviewData> {
  const admin = createAdminClient();
  const settings = await getFullSettings();
  const today = todayInCampaignTZ();

  const [
    { data: partnerships },
    { data: profiles },
    { data: installments },
    { data: receipts },
  ] = await Promise.all([
    admin.from("partnerships").select("*"),
    admin.from("profiles").select("*"),
    admin.from("installments").select("*"),
    admin.from("receipts").select("*"),
  ]);

  const profileById = new Map<string, Profile>(
    (profiles ?? []).map((p: Profile) => [p.id, p]),
  );
  const installmentsByPartnership = groupBy(
    (installments ?? []) as Installment[],
    (i) => i.partnership_id,
  );
  const receiptsByPartnership = groupBy(
    (receipts ?? []) as Receipt[],
    (r) => r.partnership_id,
  );

  const partners: PartnerRow[] = [];
  for (const p of (partnerships ?? []) as Partnership[]) {
    const profile = profileById.get(p.partner_id);
    if (!profile) continue;
    const rs = receiptsByPartnership.get(p.id) ?? [];
    const is = installmentsByPartnership.get(p.id) ?? [];
    const progress = computeProgress({
      amount: Number(p.amount),
      receipts: rs.map((r) => ({ amount: Number(r.amount), status: r.status })),
      installments: is.map((i) => ({
        sequence: i.sequence,
        dueDate: i.due_date,
        amount: Number(i.amount),
      })),
      today,
      behindGraceDays: settings.behind_grace_days,
    });
    partners.push({
      profile,
      partnership: p,
      verifiedTotal: progress.verifiedTotal,
      pendingTotal: progress.pendingTotal,
      progressPct: progress.progressPct,
      remaining: progress.remaining,
      behindBy: progress.behindBy,
      status: progress.status,
    });
  }

  const totalPendingAmount = ((receipts ?? []) as Receipt[])
    .filter((r) => r.status === "pending")
    .reduce((acc, r) => acc + Number(r.amount), 0);
  const receiptsAwaitingReview = ((receipts ?? []) as Receipt[]).filter(
    (r) => r.status === "pending",
  ).length;

  const aggregate = computeAggregate({
    goal: Number(settings.goal),
    partnerships: partners.map((p) => ({
      amount: Number(p.partnership.amount),
      status: p.partnership.status,
      verifiedTotal: p.verifiedTotal,
      derivedStatus: p.status,
    })),
    totalPendingAmount,
    receiptsAwaitingReview,
  });

  return { aggregate, goal: Number(settings.goal), partners };
}

export interface ReceiptWithPartner extends Receipt {
  partner: Pick<Profile, "id" | "full_name" | "email" | "phone">;
}

export async function getReceiptsForReview(
  status?: "pending" | "approved" | "rejected",
): Promise<ReceiptWithPartner[]> {
  const admin = createAdminClient();
  let query = admin
    .from("receipts")
    .select("*, partner:profiles!receipts_partner_id_fkey(id, full_name, email, phone)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return (data ?? []) as unknown as ReceiptWithPartner[];
}

export interface PartnerDetail {
  profile: Profile;
  partnership: Partnership | null;
  installments: Installment[];
  receipts: Receipt[];
  progress: ReturnType<typeof computeProgress> | null;
  contactLogs: Array<ContactLog & { admin_name?: string }>;
  behindGraceDays: number;
}

export async function getPartnerDetail(
  partnerId: string,
): Promise<PartnerDetail | null> {
  const admin = createAdminClient();
  const settings = await getFullSettings();
  const today = todayInCampaignTZ();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", partnerId)
    .maybeSingle();
  if (!profile) return null;

  const { data: partnership } = await admin
    .from("partnerships")
    .select("*")
    .eq("partner_id", partnerId)
    .maybeSingle();

  let installments: Installment[] = [];
  let receipts: Receipt[] = [];
  let progress: ReturnType<typeof computeProgress> | null = null;

  if (partnership) {
    const [{ data: ins }, { data: rec }] = await Promise.all([
      admin
        .from("installments")
        .select("*")
        .eq("partnership_id", partnership.id)
        .order("sequence"),
      admin
        .from("receipts")
        .select("*")
        .eq("partnership_id", partnership.id)
        .order("created_at", { ascending: false }),
    ]);
    installments = (ins ?? []) as Installment[];
    receipts = (rec ?? []) as Receipt[];
    progress = computeProgress({
      amount: Number(partnership.amount),
      receipts: receipts.map((r) => ({
        amount: Number(r.amount),
        status: r.status,
      })),
      installments: installments.map((i) => ({
        sequence: i.sequence,
        dueDate: i.due_date,
        amount: Number(i.amount),
      })),
      today,
      behindGraceDays: settings.behind_grace_days,
    });
  }

  const { data: logs } = await admin
    .from("contact_logs")
    .select("*, admin:profiles!contact_logs_admin_id_fkey(full_name)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  const contactLogs = (logs ?? []).map(
    (l: ContactLog & { admin?: { full_name: string } }) => ({
      ...l,
      admin_name: l.admin?.full_name,
    }),
  );

  return {
    profile: profile as Profile,
    partnership: (partnership as Partnership) ?? null,
    installments,
    receipts,
    progress,
    contactLogs,
    behindGraceDays: settings.behind_grace_days,
  };
}

export async function getHonorRollAdmin(): Promise<Profile[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("show_on_honor_roll", true)
    .order("full_name");
  return (data ?? []) as Profile[];
}

export async function getAllUsers(): Promise<Profile[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .order("role", { ascending: true })
    .order("full_name");
  return (data ?? []) as Profile[];
}

/**
 * Every registered user flattened into an addressable recipient, with the
 * partnership status the audience filters key off. Admins (and any partner
 * without a partnership) carry a null status.
 */
export async function getBroadcastRecipients(): Promise<BroadcastRecipient[]> {
  const [users, overview] = await Promise.all([
    getAllUsers(),
    getAdminOverview(),
  ]);
  const statusById = new Map(
    overview.partners.map((p) => [p.profile.id, p.status]),
  );
  return users.map((u) => ({
    id: u.id,
    name: u.full_name,
    email: u.email,
    role: u.role,
    status: statusById.get(u.id) ?? null,
    emailOptOut: u.email_opt_out ?? false,
  }));
}

/** Most recent broadcasts, with the admin who sent each one. */
export async function getRecentBroadcasts(
  limit = 10,
): Promise<Array<Broadcast & { sender_name?: string }>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("broadcasts")
    .select("*, sender:profiles!broadcasts_sent_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(
    (b: Broadcast & { sender?: { full_name: string } | null }) => ({
      ...b,
      sender_name: b.sender?.full_name,
    }),
  );
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}
