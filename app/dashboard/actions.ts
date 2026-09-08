"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { receiptSchema, validateFile } from "@/lib/validation";
import { objectNameFor } from "@/lib/upload";
import { partnerSettingsSchema } from "@/lib/validation";
import { sendReceiptReceivedEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export interface ReceiptActionState {
  error?: string;
  success?: boolean;
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
  const storage = createAdminClient().storage.from("receipts");

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
  const fileError = validateFile({
    type: object.metadata?.mimetype ?? "",
    size: object.metadata?.size ?? 0,
    name: objectName,
  });
  if (fileError) {
    await storage.remove([path]);
    return { error: fileError };
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

  await supabase.storage.from("receipts").remove([receipt.file_path]);
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
    .from("receipts")
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
