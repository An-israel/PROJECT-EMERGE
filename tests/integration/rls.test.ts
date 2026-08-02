import { describe, it, expect, afterAll } from "vitest";
import {
  supabaseConfigured,
  adminClient,
  anonClient,
  uniqueEmail,
} from "./helpers";
import { generateSchedule } from "@/lib/schedule";
import { CAMPAIGN } from "@/lib/constants";

const d = supabaseConfigured ? describe : describe.skip;

d("RLS isolation (integration)", () => {
  const admin = supabaseConfigured ? adminClient() : (null as unknown as ReturnType<typeof adminClient>);
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  });

  async function makePartner(amount: number) {
    const email = uniqueEmail("rls");
    const password = "TestPass!2026";
    const { data } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    const userId = data!.user!.id;
    created.push(userId);
    const startDate = new Date().toISOString().slice(0, 10);
    const schedule = generateSchedule({
      amount,
      plan: "one_time",
      startDate,
      monthlyIntervalMonths: CAMPAIGN.monthlyIntervalMonths,
      oneTimeGraceDays: CAMPAIGN.oneTimeGraceDays,
    });
    await admin.rpc("create_partner_signup", {
      p_user_id: userId,
      p_full_name: "RLS Tester",
      p_email: email,
      p_phone: "08000000000",
      p_show_on_honor_roll: false,
      p_honor_roll_name: "",
      p_tier: String(amount),
      p_amount: amount,
      p_plan: "one_time",
      p_start_date: startDate,
      p_installments: schedule.map((s) => ({
        sequence: s.sequence,
        due_date: s.dueDate,
        amount: s.amount,
      })),
    });
    return { userId, email, password };
  }

  it("partner A cannot read partner B's partnership, installments, or receipts", async () => {
    const a = await makePartner(100000);
    const b = await makePartner(200000);

    const { data: bPartnership } = await admin
      .from("partnerships")
      .select("id")
      .eq("partner_id", b.userId)
      .single();

    // Sign in as A on an anon client (RLS active).
    const clientA = anonClient();
    await clientA.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });

    const { data: seenPartnerships } = await clientA
      .from("partnerships")
      .select("*")
      .eq("partner_id", b.userId);
    expect(seenPartnerships ?? []).toHaveLength(0);

    const { data: seenInstallments } = await clientA
      .from("installments")
      .select("*")
      .eq("partnership_id", bPartnership!.id);
    expect(seenInstallments ?? []).toHaveLength(0);

    const { data: seenReceipts } = await clientA
      .from("receipts")
      .select("*")
      .eq("partner_id", b.userId);
    expect(seenReceipts ?? []).toHaveLength(0);
  });

  it("a partner cannot read the goal or aggregate totals", async () => {
    const a = await makePartner(100000);
    const clientA = anonClient();
    await clientA.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });

    // settings (with goal) is admin-only under RLS.
    const { data: settings } = await clientA
      .from("settings")
      .select("goal");
    expect(settings ?? []).toHaveLength(0);

    // The public_settings view exposes bank/campaign but NOT the goal.
    const { data: publicSettings } = await clientA
      .from("public_settings")
      .select("*")
      .single();
    if (publicSettings) {
      expect(Object.keys(publicSettings)).not.toContain("goal");
    }
  });

  it("a partner cannot read another partner's storage files", async () => {
    const a = await makePartner(100000);
    const b = await makePartner(100000);

    // Admin uploads a file under B's prefix.
    const path = `${b.userId}/secret.txt`;
    await admin.storage
      .from("receipts")
      .upload(path, new Blob(["secret"]), { upsert: true });

    const clientA = anonClient();
    await clientA.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });

    const { data, error } = await clientA.storage
      .from("receipts")
      .download(path);
    // Either an error or no data — never the file contents.
    expect(data).toBeFalsy();
    expect(error).toBeTruthy();
  });
});
