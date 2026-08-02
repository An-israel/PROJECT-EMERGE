"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFullSettings } from "@/lib/settings";
import { signUpSchema, resolveAmount } from "@/lib/validation";
import { generateSchedule } from "@/lib/schedule";
import { todayInCampaignTZ } from "@/lib/time";
import { sendWelcomeEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export interface SignUpState {
  error?: string;
}

export async function signUpAction(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const hdrs = await headers();
  const limit = rateLimit(`signup:${clientIp(hdrs)}`, 5, 60_000);
  if (!limit.ok) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }

  const rawCustom = formData.get("customAmount");
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    tier: formData.get("tier"),
    plan: formData.get("plan"),
    customAmount:
      rawCustom && String(rawCustom).length > 0
        ? Number(rawCustom)
        : undefined,
    showOnHonorRoll: formData.get("showOnHonorRoll") === "on",
    honorRollName: formData.get("honorRollName") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }
  const input = parsed.data;
  const amount = resolveAmount(input);

  const settings = await getFullSettings();
  const startDate = todayInCampaignTZ();
  const schedule = generateSchedule({
    amount,
    plan: input.plan,
    startDate,
    monthlyIntervalMonths: settings.monthly_interval_months,
    oneTimeGraceDays: settings.one_time_grace_days,
  });

  const admin = createAdminClient();

  // 1) Create the auth user (email confirmed so the account works without
  //    email being configured).
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: input.email,
      password: input.password,
      email_confirm: true,
    },
  );
  if (createErr || !created.user) {
    if (createErr?.message?.toLowerCase().includes("already")) {
      return { error: "An account with this email already exists. Log in instead." };
    }
    return { error: "We could not create your account. Please try again." };
  }
  const userId = created.user.id;

  // 2) Atomic profile + partnership + installments via one RPC.
  const { error: rpcErr } = await admin.rpc("create_partner_signup", {
    p_user_id: userId,
    p_full_name: input.fullName,
    p_email: input.email,
    p_phone: input.phone,
    p_show_on_honor_roll: input.showOnHonorRoll,
    p_honor_roll_name: input.honorRollName ?? "",
    p_tier: input.tier,
    p_amount: amount,
    p_plan: input.plan,
    p_start_date: startDate,
    p_installments: schedule.map((s) => ({
      sequence: s.sequence,
      due_date: s.dueDate,
      amount: s.amount,
    })),
  });

  if (rpcErr) {
    // Compensate: remove the orphaned auth user so there are no half-accounts.
    await admin.auth.admin.deleteUser(userId);
    if (rpcErr.message?.includes("unique") || rpcErr.code === "23505") {
      return { error: "You already have a partnership on this account." };
    }
    return { error: "We could not complete your sign up. Please try again." };
  }

  // 3) Sign the new user in to set the session cookie.
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  // 4) Welcome email (degrades gracefully without Resend).
  await sendWelcomeEmail({
    to: input.email,
    name: input.fullName,
    amount,
    plan: input.plan,
    schedule,
    bank: {
      accountName: settings.bank_account_name,
      accountNumber: settings.bank_account_number,
      bankName: settings.bank_name,
    },
  });

  redirect("/dashboard");
}
