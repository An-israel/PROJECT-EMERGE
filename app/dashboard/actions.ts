"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import {
  pledgeSchema,
  receiptSchema,
  resolveAmount,
  validateFile,
} from "@/lib/validation";
import { getFullSettings } from "@/lib/settings";
import { generateSchedule } from "@/lib/schedule";
import { todayInCampaignTZ } from "@/lib/time";
import {
  RECEIPT_BUCKET,
  objectNameFor,
  receiptObjectPath,
} from "@/lib/upload";
import { partnerSettingsSchema } from "@/lib/validation";
import { sendReceiptReceivedEmail, sendWelcomeEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export interface ReceiptActionState {
  error?: string;
  success?: boolean;
  /** Raw provider error, shown in small print so a failure is diagnosable. */
  detail?: string;
}

export interface ReceiptUploadTicket {
  path?: string;
  token?: string;
  error?: string;
  detail?: string;
}

/**
 * Mint a one-time signed upload URL for this partner's next receipt.
 *
 * Uses the service role deliberately: the browser then uploads without
 * relying on storage RLS policies existing in the project. The path is built
 * here from the session, so a partner can still only ever write to their own
 * folder — the client does not get to choose where the file lands.
 */
export async function createReceiptUploadTicketAction(
  fileName: string,
  mimeType: string,
): Promise<ReceiptUploadTicket> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please log in again." };

  const hdrs = await headers();
  const limit = rateLimit(
    `receipt-ticket:${profile.id}:${clientIp(hdrs)}`,
    20,
    60_000,
  );
  if (!limit.ok) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }

  const path = receiptObjectPath(profile.id, fileName ?? "", mimeType ?? "");
  const { data, error } = await createAdminClient()
    .storage.from(RECEIPT_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[receipt:signed-upload-url]", error);
    return {
      error: "We could not start the upload. Please tell the church admin.",
      detail: error?.message,
    };
  }
  return { path: data.path ?? path, token: data.token };
}

export async function uploadReceiptAction(
  _prev: ReceiptActionState,
  formData: FormData,
): Promise<ReceiptActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please log in again." };

  const hdrs = await headers();
  const limit = rateLimit(`receipt:${profile.id}:${clientIp(hdrs)}`, 10, 60_000);
  if (!limit.ok) {
    return { error: "Too many uploads. Please wait a minute and try again." };
  }

  const parsed = receiptSchema.safeParse({
    amount: Number(formData.get("amount")),
    transferDate: formData.get("transferDate"),
    reference: formData.get("reference") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  // The browser uploads the file straight to Storage and sends us its path —
  // a Server Action body is capped at 1MB, far below a phone photo.
  const path = formData.get("filePath");
  if (typeof path !== "string" || !path) {
    return { error: "Please attach your receipt file." };
  }
  const objectName = objectNameFor(path, profile.id);
  if (!objectName) {
    return { error: "That file does not belong to your account." };
  }

  const supabase = await createClient();
  const storage = createAdminClient().storage.from(RECEIPT_BUCKET);

  // Confirm the object really landed, and re-check size and type here — the
  // browser's word is not enough on its own.
  const { data: objects } = await storage.list(profile.id, {
    search: objectName,
    limit: 1,
  });
  const object = objects?.find((o) => o.name === objectName);
  if (!object) {
    return {
      error: "We could not find your uploaded file. Please try again.",
    };
  }
  // Storage does not always report metadata. Only judge what it actually
  // tells us — never reject a real receipt because a field was missing.
  const size = object.metadata?.size;
  const mimetype = object.metadata?.mimetype;
  if (typeof size === "number" || typeof mimetype === "string") {
    const fileError = validateFile({
      type: typeof mimetype === "string" ? mimetype : "",
      size: typeof size === "number" ? size : 1,
      name: objectName,
    });
    if (fileError) {
      await storage.remove([path]);
      return { error: fileError };
    }
  }

  // Find the partner's partnership.
  const { data: partnership } = await supabase
    .from("partnerships")
    .select("id")
    .eq("partner_id", profile.id)
    .maybeSingle();
  if (!partnership) {
    await storage.remove([path]);
    return { error: "No partnership found on your account." };
  }

  const { error: insertErr } = await supabase.from("receipts").insert({
    partner_id: profile.id,
    partnership_id: partnership.id,
    amount: parsed.data.amount,
    transfer_date: parsed.data.transferDate,
    reference: parsed.data.reference || null,
    note: parsed.data.note || null,
    file_path: path,
    status: "pending",
  });
  if (insertErr) {
    // Roll back the uploaded file.
    await storage.remove([path]);
    return { error: "We could not save your receipt. Please try again." };
  }

  await sendReceiptReceivedEmail({
    to: profile.email,
    name: profile.full_name,
    amount: parsed.data.amount,
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function deletePendingReceiptAction(
  receiptId: string,
): Promise<ReceiptActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please log in again." };

  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, file_path, status, partner_id")
    .eq("id", receiptId)
    .maybeSingle();

  if (!receipt || receipt.partner_id !== profile.id) {
    return { error: "Receipt not found." };
  }
  if (receipt.status !== "pending") {
    return { error: "Only a pending receipt can be removed." };
  }

  // RLS permits deleting own pending receipt.
  const { error } = await supabase.from("receipts").delete().eq("id", receiptId);
  if (error) return { error: "We could not remove that receipt." };

  await createAdminClient()
    .storage.from(RECEIPT_BUCKET)
    .remove([receipt.file_path]);
  revalidatePath("/dashboard");
  return { success: true };
}

/** Short-lived signed URL for viewing a receipt file (owner or admin only). */
export async function getReceiptSignedUrl(
  receiptId: string,
): Promise<{ url?: string; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please log in again." };

  const supabase = await createClient();
  // RLS ensures this returns the row only if owner or admin.
  const { data: receipt } = await supabase
    .from("receipts")
    .select("file_path, partner_id")
    .eq("id", receiptId)
    .maybeSingle();

  if (!receipt) return { error: "Receipt not found." };
  if (profile.role !== "admin" && receipt.partner_id !== profile.id) {
    return { error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(receipt.file_path, 60 * 5); // 5 minutes
  if (error || !data) return { error: "Could not open the file." };
  return { url: data.signedUrl };
}

export async function updatePartnerSettingsAction(
  _prev: ReceiptActionState,
  formData: FormData,
): Promise<ReceiptActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please log in again." };

  const parsed = partnerSettingsSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    showOnHonorRoll: formData.get("showOnHonorRoll") === "on",
    honorRollName: formData.get("honorRollName") ?? "",
    receiveAnnouncements: formData.get("receiveAnnouncements") === "on",
    receiveSms: formData.get("receiveSms") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      show_on_honor_roll: parsed.data.showOnHonorRoll,
      honor_roll_name: parsed.data.honorRollName || null,
      email_opt_out: !parsed.data.receiveAnnouncements,
      sms_opt_out: !parsed.data.receiveSms,
    })
    .eq("id", profile.id);
  if (error) return { error: "We could not save your changes." };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

/**
 * Create a partnership for the signed-in account.
 *
 * Sign up creates a new auth user, so it was no help to someone who already
 * had an account — an admin seeded by `pnpm seed`, or anyone promoted to
 * admin before they pledged. They had a profile, no partnership, and so no
 * way to upload receipts or have their giving counted.
 *
 * Runs through the user-scoped client on purpose: the RPC is keyed on
 * auth.uid(), so a partnership can only ever be created for the caller.
 */
export async function createOwnPartnershipAction(
  _prev: ReceiptActionState,
  formData: FormData,
): Promise<ReceiptActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please log in again." };

  const hdrs = await headers();
  const limit = rateLimit(`pledge:${profile.id}:${clientIp(hdrs)}`, 5, 60_000);
  if (!limit.ok) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }

  const rawCustom = formData.get("customAmount");
  const parsed = pledgeSchema.safeParse({
    tier: formData.get("tier"),
    plan: formData.get("plan"),
    customAmount:
      rawCustom && String(rawCustom).length > 0 ? Number(rawCustom) : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  const amount = resolveAmount(parsed.data);
  const settings = await getFullSettings();
  const startDate = todayInCampaignTZ();
  const schedule = generateSchedule({
    amount,
    plan: parsed.data.plan,
    startDate,
    monthlyIntervalMonths: settings.monthly_interval_months,
    oneTimeGraceDays: settings.one_time_grace_days,
  });

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_partnership_for_me", {
    p_tier: parsed.data.tier,
    p_amount: amount,
    p_plan: parsed.data.plan,
    p_start_date: startDate,
    p_installments: schedule.map((s) => ({
      sequence: s.sequence,
      due_date: s.dueDate,
      amount: s.amount,
    })),
  });

  if (error) {
    if (error.code === "23505" || error.message?.includes("unique")) {
      return { error: "You already have a partnership on this account." };
    }
    console.error("[pledge:create]", error);
    return {
      error: "We could not set up your partnership. Please try again.",
      detail: error.message,
    };
  }

  await sendWelcomeEmail({
    to: profile.email,
    name: profile.full_name,
    amount,
    plan: parsed.data.plan,
    schedule,
    bank: {
      accountName: settings.bank_account_name,
      accountNumber: settings.bank_account_number,
      bankName: settings.bank_name,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/admin/partners");
  return { success: true };
}
