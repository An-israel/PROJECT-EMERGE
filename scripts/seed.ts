/**
 * Seed script (spec section 11). Run with: `pnpm seed` (add `--demo` for demo data).
 *
 * - Inserts the single settings row with all campaign constants.
 * - Creates one admin user from SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD (or a
 *   documented default, with a loud warning).
 * - With --demo, creates three demo partners across tiers/plans with a mix of
 *   approved/pending/on-track/behind states. Refuses to run demo in production.
 */
import { createClient } from "@supabase/supabase-js";
import { CAMPAIGN } from "../lib/constants";
import { generateSchedule } from "../lib/schedule";
import { addDays } from "../lib/date";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env first.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO = process.argv.includes("--demo");
const IS_PROD = process.env.NODE_ENV === "production";

async function seedSettings() {
  const { error } = await admin.from("settings").upsert(
    {
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
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  console.log("✓ settings row seeded");
}

async function ensureUser(
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    // Already exists — look it up.
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === email);
    if (existing) return existing.id;
    throw error;
  }
  return data.user.id;
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ideallifecity.org";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Emerge2026";
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn(
      `⚠ Using default admin password "ChangeMe!Emerge2026". Change it immediately after first login, or set SEED_ADMIN_PASSWORD.`,
    );
  }
  const userId = await ensureUser(email, password);
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      full_name: "Ideal Life City Admin",
      email,
      phone: "0000000000",
      role: "admin",
      show_on_honor_roll: false,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  console.log(`✓ admin user seeded: ${email}`);
}

async function seedDemo() {
  if (IS_PROD) {
    console.error("Refusing to seed demo data in production.");
    return;
  }
  console.log("Seeding demo partners…");
  const today = new Date().toISOString().slice(0, 10);

  const demos = [
    {
      email: "demo.ontrack@example.com",
      name: "Grace Okonkwo",
      phone: "08030000001",
      tier: "500000" as const,
      amount: 500000,
      plan: "three_months" as const,
      startOffsetDays: -35, // one installment due already
      approved: [200000],
      pending: [],
      honor: true,
    },
    {
      email: "demo.behind@example.com",
      name: "Samuel Adewale",
      phone: "08030000002",
      tier: "300000" as const,
      amount: 300000,
      plan: "three_months" as const,
      startOffsetDays: -70, // two installments due, little paid
      approved: [50000],
      pending: [25000],
      honor: false,
    },
    {
      email: "demo.completed@example.com",
      name: "Blessing Eze",
      phone: "08030000003",
      tier: "100000" as const,
      amount: 100000,
      plan: "one_time" as const,
      startOffsetDays: -10,
      approved: [100000],
      pending: [],
      honor: true,
    },
  ];

  for (const d of demos) {
    const userId = await ensureUser(d.email, "DemoPass!2026");
    const startDate = addDays(today, d.startOffsetDays);
    const schedule = generateSchedule({
      amount: d.amount,
      plan: d.plan,
      startDate,
      monthlyIntervalMonths: CAMPAIGN.monthlyIntervalMonths,
      oneTimeGraceDays: CAMPAIGN.oneTimeGraceDays,
    });

    await admin.from("profiles").upsert(
      {
        id: userId,
        full_name: d.name,
        email: d.email,
        phone: d.phone,
        role: "partner",
        show_on_honor_roll: d.honor,
      },
      { onConflict: "id" },
    );

    // Reset any prior demo partnership for idempotency.
    await admin.from("partnerships").delete().eq("partner_id", userId);

    const { data: partnership, error: pErr } = await admin
      .from("partnerships")
      .insert({
        partner_id: userId,
        tier: d.tier,
        amount: d.amount,
        plan: d.plan,
        start_date: startDate,
      })
      .select("id")
      .single();
    if (pErr) throw pErr;

    await admin.from("installments").insert(
      schedule.map((s) => ({
        partnership_id: partnership.id,
        sequence: s.sequence,
        due_date: s.dueDate,
        amount: s.amount,
      })),
    );

    for (const amount of d.approved) {
      await admin.from("receipts").insert({
        partner_id: userId,
        partnership_id: partnership.id,
        amount,
        transfer_date: today,
        file_path: `${userId}/demo-approved-${amount}.pdf`,
        status: "approved",
        reviewed_at: new Date().toISOString(),
      });
    }
    for (const amount of d.pending) {
      await admin.from("receipts").insert({
        partner_id: userId,
        partnership_id: partnership.id,
        amount,
        transfer_date: today,
        file_path: `${userId}/demo-pending-${amount}.pdf`,
        status: "pending",
      });
    }
    console.log(`  ✓ demo partner: ${d.name}`);
  }
}

async function main() {
  await seedSettings();
  await seedAdmin();
  if (DEMO) await seedDemo();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
