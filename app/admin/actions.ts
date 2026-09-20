"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { getFullSettings } from "@/lib/settings";
import { computeProgress } from "@/lib/progress";
import { todayInCampaignTZ } from "@/lib/time";
import {
  sendReceiptApprovedEmail,
  sendReceiptRejectedEmail,
  sendBehindReminderEmail,
} from "@/lib/email";
import {
  rejectReceiptSchema,
  contactLogSchema,
  adminSettingsSchema,
  validateImageFile,
} from "@/lib/validation";
import type { Installment, Receipt } from "@/lib/supabase/types";

export interface AdminActionState {
  error?: string;
  success?: boolean;
}

async function ensureAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

/** Recompute a partnership's verified total + remaining from its data. */
async function partnershipProgress(partnershipId: string) {
  const admin = createAdminClient();
  const settings = await getFullSettings();
  const [{ data: partnership }, { data: ins }, { data: rec }] =
    await Promise.all([
      admin.from("partnerships").select("*").eq("id", partnershipId).single(),
      admin.from("installments").select("*").eq("partnership_id", partnershipId),
      admin.from("receipts").select("*").eq("partnership_id", partnershipId),
    ]);
  if (!partnership) return null;
  return computeProgress({
    amount: Number(partnership.amount),
    receipts: ((rec ?? []) as Receipt[]).map((r) => ({
      amount: Number(r.amount),
      status: r.status,
    })),
    installments: ((ins ?? []) as Installment[]).map((i) => ({
      sequence: i.sequence,
      dueDate: i.due_date,
      amount: Number(i.amount),
    })),
    today: todayInCampaignTZ(),
    behindGraceDays: settings.behind_grace_days,
  });
}

export async function approveReceiptAction(
  receiptId: string,
): Promise<AdminActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };
  const db = createAdminClient();

  const { data: receipt } = await db
    .from("receipts")
    .select("*, partner:profiles!receipts_partner_id_fkey(full_name, email)")
    .eq("id", receiptId)
    .single();
  if (!receipt) return { error: "Receipt not found." };

  const { error } = await db
    .from("receipts")
    .update({
      status: "approved",
      reject_reason: null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", receiptId);
  if (error) return { error: "Could not approve the receipt." };

  const progress = await partnershipProgress(receipt.partnership_id);
  const partner = receipt.partner as { full_name: string; email: string };
  await sendReceiptApprovedEmail({
    to: partner.email,
    name: partner.full_name,
    amount: Number(receipt.amount),
    verifiedTotal: progress?.verifiedTotal ?? Number(receipt.amount),
    remaining: progress?.remaining ?? 0,
  });

  // Mark partnership completed if fully paid.
  if (progress && progress.status === "completed") {
    await db
      .from("partnerships")
      .update({ status: "completed" })
      .eq("id", receipt.partnership_id);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/receipts");
  return { success: true };
}

export async function rejectReceiptAction(
  receiptId: string,
  reason: string,
): Promise<AdminActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };
  const parsed = rejectReceiptSchema.safeParse({ receiptId, reason });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "A reason is required." };
  }
  const db = createAdminClient();
  const { data: receipt } = await db
    .from("receipts")
    .select("*, partner:profiles!receipts_partner_id_fkey(full_name, email)")
    .eq("id", receiptId)
    .single();
  if (!receipt) return { error: "Receipt not found." };

  const { error } = await db
    .from("receipts")
    .update({
      status: "rejected",
      reject_reason: parsed.data.reason,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", receiptId);
  if (error) return { error: "Could not reject the receipt." };

  const partner = receipt.partner as { full_name: string; email: string };
  await sendReceiptRejectedEmail({
    to: partner.email,
    name: partner.full_name,
    amount: Number(receipt.amount),
    reason: parsed.data.reason,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/receipts");
  return { success: true };
}

export async function logContactAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };
  const parsed = contactLogSchema.safeParse({
    partnerId: formData.get("partnerId"),
    method: formData.get("method"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const db = createAdminClient();
  const { error } = await db.from("contact_logs").insert({
    partner_id: parsed.data.partnerId,
    admin_id: admin.id,
    method: parsed.data.method,
    note: parsed.data.note || null,
  });
  if (error) return { error: "Could not log the contact." };
  revalidatePath(`/admin/partners/${parsed.data.partnerId}`);
  return { success: true };
}

export async function sendBehindReminderAction(
  partnerId: string,
): Promise<AdminActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };
  const db = createAdminClient();
  const settings = await getFullSettings();
  const { data: profile } = await db
    .from("profiles")
    .select("full_name, email")
    .eq("id", partnerId)
    .single();
  const { data: partnership } = await db
    .from("partnerships")
    .select("id")
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (!profile || !partnership) return { error: "Partner not found." };
  const progress = await partnershipProgress(partnership.id);

  await sendBehindReminderEmail({
    to: profile.email,
    name: profile.full_name,
    behindBy: progress?.behindBy ?? 0,
    bank: {
      accountName: settings.bank_account_name,
      accountNumber: settings.bank_account_number,
      bankName: settings.bank_name,
    },
  });
  return { success: true };
}

export async function setUserRoleAction(
  userId: string,
  role: "admin" | "partner",
): Promise<AdminActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };
  const db = createAdminClient();
  // The DB trigger blocks demoting the last admin; surface that clearly.
  const { error } = await db
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) {
    if (error.message?.includes("last remaining admin")) {
      return { error: "You cannot demote the last remaining admin." };
    }
    return { error: "Could not update the role." };
  }
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function toggleHonorRollAction(
  userId: string,
  show: boolean,
): Promise<AdminActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };
  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({ show_on_honor_roll: show })
    .eq("id", userId);
  if (error) return { error: "Could not update visibility." };
  revalidatePath("/admin/honor-roll");
  return { success: true };
}

export async function updateAdminSettingsAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };
  const parsed = adminSettingsSchema.safeParse({
    campaignTitle: formData.get("campaignTitle"),
    campaignSubtitle: formData.get("campaignSubtitle"),
    scripture: formData.get("scripture"),
    heroBody: formData.get("heroBody") ?? "",
    visionBody: formData.get("visionBody") ?? "",
    goal: formData.get("goal"),
    bankAccountName: formData.get("bankAccountName"),
    bankAccountNumber: formData.get("bankAccountNumber"),
    bankName: formData.get("bankName"),
    contactPhone: formData.get("contactPhone") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    contactAddress: formData.get("contactAddress") ?? "",
    oneTimeGraceDays: formData.get("oneTimeGraceDays"),
    monthlyIntervalMonths: formData.get("monthlyIntervalMonths"),
    behindGraceDays: formData.get("behindGraceDays"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values." };
  }
  const db = createAdminClient();
  const { error } = await db
    .from("settings")
    .update({
      campaign_title: parsed.data.campaignTitle,
      campaign_subtitle: parsed.data.campaignSubtitle,
      scripture: parsed.data.scripture,
      hero_body: parsed.data.heroBody || null,
      vision_body: parsed.data.visionBody || null,
      goal: parsed.data.goal,
      bank_account_name: parsed.data.bankAccountName,
      bank_account_number: parsed.data.bankAccountNumber,
      bank_name: parsed.data.bankName,
      contact_phone: parsed.data.contactPhone || null,
      contact_email: parsed.data.contactEmail || null,
      contact_address: parsed.data.contactAddress || null,
      one_time_grace_days: parsed.data.oneTimeGraceDays,
      monthly_interval_months: parsed.data.monthlyIntervalMonths,
      behind_grace_days: parsed.data.behindGraceDays,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: "Could not save settings." };
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { success: true };
}

const BRANDING_BUCKET = "branding";

/** Extract the object path within the branding bucket from a stored public URL. */
function brandingPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/${BRANDING_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

/** Upload a landing-page hero background and store its public URL in settings. */
export async function uploadHeroBackgroundAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose an image to upload." };
  }
  const fileError = validateImageFile({ type: file.type, size: file.size });
  if (fileError) return { error: fileError };

  const db = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `hero/${Date.now()}-background.${ext}`;

  const { error: uploadErr } = await db.storage
    .from(BRANDING_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) {
    return { error: "We could not upload the image. Please try again." };
  }

  const {
    data: { publicUrl },
  } = db.storage.from(BRANDING_BUCKET).getPublicUrl(path);

  // Read the current URL so we can clean up the old file after a successful swap.
  const { data: current } = await db
    .from("settings")
    .select("hero_image_url")
    .eq("id", 1)
    .single();

  const { error: saveErr } = await db
    .from("settings")
    .update({ hero_image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (saveErr) {
    await db.storage.from(BRANDING_BUCKET).remove([path]); // roll back the upload
    return { error: "We could not save the background. Please try again." };
  }

  const oldPath = brandingPathFromUrl(current?.hero_image_url ?? null);
  if (oldPath && oldPath !== path) {
    await db.storage.from(BRANDING_BUCKET).remove([oldPath]);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { success: true };
}

/** Remove the hero background so the landing page returns to the paper look. */
export async function removeHeroBackgroundAction(): Promise<AdminActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };

  const db = createAdminClient();
  const { data: current } = await db
    .from("settings")
    .select("hero_image_url")
    .eq("id", 1)
    .single();

  const { error } = await db
    .from("settings")
    .update({ hero_image_url: null, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: "Could not remove the background." };

  const oldPath = brandingPathFromUrl(current?.hero_image_url ?? null);
  if (oldPath) await db.storage.from(BRANDING_BUCKET).remove([oldPath]);

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { success: true };
}
