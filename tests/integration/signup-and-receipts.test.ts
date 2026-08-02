import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  supabaseConfigured,
  adminClient,
  uniqueEmail,
} from "./helpers";
import { generateSchedule } from "@/lib/schedule";
import { CAMPAIGN } from "@/lib/constants";

const d = supabaseConfigured ? describe : describe.skip;

if (!supabaseConfigured) {
  // Visible reason in the test output.
  describe("integration (skipped)", () => {
    it.skip("requires a configured Supabase project (set env to run)", () => {});
  });
}

d("signup + receipts (integration)", () => {
  const admin = supabaseConfigured ? adminClient() : (null as unknown as ReturnType<typeof adminClient>);
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  });

  async function makePartner(amount: number, plan: Parameters<typeof generateSchedule>[0]["plan"]) {
    const email = uniqueEmail("int");
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "TestPass!2026",
      email_confirm: true,
    });
    const userId = data!.user!.id;
    created.push(userId);
    const startDate = new Date().toISOString().slice(0, 10);
    const schedule = generateSchedule({
      amount,
      plan,
      startDate,
      monthlyIntervalMonths: CAMPAIGN.monthlyIntervalMonths,
      oneTimeGraceDays: CAMPAIGN.oneTimeGraceDays,
    });
    const { error } = await admin.rpc("create_partner_signup", {
      p_user_id: userId,
      p_full_name: "Integration Tester",
      p_email: email,
      p_phone: "08000000000",
      p_show_on_honor_roll: false,
      p_honor_roll_name: "",
      p_tier: String(amount),
      p_amount: amount,
      p_plan: plan,
      p_start_date: startDate,
      p_installments: schedule.map((s) => ({
        sequence: s.sequence,
        due_date: s.dueDate,
        amount: s.amount,
      })),
    });
    expect(error).toBeNull();
    return { userId, email };
  }

  it("creates exactly one profile, one partnership, and correct installments", async () => {
    const { userId } = await makePartner(300000, "three_months");

    const { data: profiles } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId);
    expect(profiles).toHaveLength(1);

    const { data: partnerships } = await admin
      .from("partnerships")
      .select("*")
      .eq("partner_id", userId);
    expect(partnerships).toHaveLength(1);

    const { data: installments } = await admin
      .from("installments")
      .select("*")
      .eq("partnership_id", partnerships![0].id);
    expect(installments).toHaveLength(3);
    const sum = installments!.reduce(
      (acc, i) => acc + Number(i.amount),
      0,
    );
    expect(sum).toBe(300000);
  });

  it("rolls back fully when an installment is invalid (atomicity)", async () => {
    const email = uniqueEmail("int-rollback");
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "TestPass!2026",
      email_confirm: true,
    });
    const userId = data!.user!.id;
    created.push(userId);

    // Force a failure: a duplicate sequence violates the unique constraint.
    const { error } = await admin.rpc("create_partner_signup", {
      p_user_id: userId,
      p_full_name: "Rollback Tester",
      p_email: email,
      p_phone: "08000000000",
      p_show_on_honor_roll: false,
      p_honor_roll_name: "",
      p_tier: "300000",
      p_amount: 300000,
      p_plan: "three_months",
      p_start_date: new Date().toISOString().slice(0, 10),
      p_installments: [
        { sequence: 1, due_date: "2026-02-15", amount: 100000 },
        { sequence: 1, due_date: "2026-03-15", amount: 100000 },
      ],
    });
    expect(error).not.toBeNull();

    // No profile or partnership should have been created.
    const { data: profiles } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId);
    expect(profiles).toHaveLength(0);
    const { data: partnerships } = await admin
      .from("partnerships")
      .select("id")
      .eq("partner_id", userId);
    expect(partnerships).toHaveLength(0);
  });

  it("admin approve raises verified total; reject requires a reason", async () => {
    const { userId } = await makePartner(500000, "one_time");
    const { data: partnership } = await admin
      .from("partnerships")
      .select("id")
      .eq("partner_id", userId)
      .single();

    const { data: receipt } = await admin
      .from("receipts")
      .insert({
        partner_id: userId,
        partnership_id: partnership!.id,
        amount: 200000,
        transfer_date: new Date().toISOString().slice(0, 10),
        file_path: `${userId}/test.pdf`,
        status: "pending",
      })
      .select("id")
      .single();

    // Reject without a reason is blocked by the DB constraint.
    const { error: badReject } = await admin
      .from("receipts")
      .update({ status: "rejected" })
      .eq("id", receipt!.id);
    expect(badReject).not.toBeNull();

    // Approve.
    await admin
      .from("receipts")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", receipt!.id);

    const { data: approved } = await admin
      .from("receipts")
      .select("amount")
      .eq("partnership_id", partnership!.id)
      .eq("status", "approved");
    const verified = approved!.reduce((a, r) => a + Number(r.amount), 0);
    expect(verified).toBe(200000);
  });
});
