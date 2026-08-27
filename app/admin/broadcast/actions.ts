"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { getBroadcastRecipients } from "@/lib/admin-data";
import { rateLimit } from "@/lib/rate-limit";
import { broadcastSchema, smsBroadcastSchema } from "@/lib/validation";
import {
  renderBroadcastEmail,
  sendBroadcastEmails,
  type BroadcastEmailMessage,
} from "@/lib/email";
import { sendBulkSms, type SmsMessage } from "@/lib/sms";
import {
  BROADCAST_BATCH_SIZE,
  personalize,
  selectRecipients,
  textToHtml,
  type BroadcastAudience,
  type BroadcastRecipient,
} from "@/lib/broadcast";
import type { BroadcastStatus } from "@/lib/constants";
import { toE164 } from "@/lib/phone";
import type { Profile } from "@/lib/supabase/types";

export interface BroadcastActionState {
  error?: string;
  success?: boolean;
  /** Human-readable outcome, e.g. "Sent to 42 people." */
  message?: string;
}

async function ensureAdmin(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Build one personalised message per recipient. */
function buildMessages(
  recipients: BroadcastRecipient[],
  subject: string,
  body: string,
): BroadcastEmailMessage[] {
  const url = siteUrl();
  return recipients.map((person) => ({
    to: person.email,
    subject: personalize(subject, person),
    html: renderBroadcastEmail({
      title: personalize(subject, person),
      bodyHtml: textToHtml(personalize(body, person)),
      siteUrl: url,
    }),
  }));
}

function parseForm(formData: FormData) {
  return broadcastSchema.safeParse({
    audience: formData.get("audience"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
}

/**
 * Send a one-off test of the composed email to the signed-in admin only.
 * Nothing is recorded — this is a preview, not a broadcast.
 */
export async function sendTestBroadcastAction(
  _prev: BroadcastActionState,
  formData: FormData,
): Promise<BroadcastActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the message." };
  }

  const limit = rateLimit(`broadcast:test:${admin.id}`, 10, 60_000);
  if (!limit.ok) {
    return { error: "Too many test sends. Please wait a minute." };
  }

  const me: BroadcastRecipient = {
    id: admin.id,
    name: admin.full_name,
    email: admin.email,
    phone: admin.phone,
    role: admin.role,
    status: null,
    emailOptOut: false,
    smsOptOut: false,
  };
  const result = await sendBroadcastEmails(
    buildMessages([me], `[Test] ${parsed.data.subject}`, parsed.data.body),
  );

  if (result.skipped) {
    return {
      success: true,
      message:
        "Email is not configured (RESEND_API_KEY is unset), so the test was written to the server log instead of being delivered.",
    };
  }
  if (result.failed > 0) {
    return { error: result.errors[0] ?? "The test email could not be sent." };
  }
  return { success: true, message: `Test sent to ${admin.email}.` };
}

/**
 * Email every registered user in the chosen audience. Opted-out users are
 * always excluded. The send is recorded in `broadcasts` either way, so the
 * church has a history of what went out to whom.
 */
export async function sendBroadcastAction(
  _prev: BroadcastActionState,
  formData: FormData,
): Promise<BroadcastActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the message." };
  }

  const limit = rateLimit(`broadcast:send:${admin.id}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return {
      error:
        "You have sent several broadcasts in a row. Please wait a few minutes before sending another.",
    };
  }

  const audience = parsed.data.audience as BroadcastAudience;
  const recipients = selectRecipients(await getBroadcastRecipients(), audience);
  if (recipients.length === 0) {
    return { error: "Nobody matches that audience right now." };
  }

  const result = await sendBroadcastEmails(
    buildMessages(recipients, parsed.data.subject, parsed.data.body),
    { batchSize: BROADCAST_BATCH_SIZE },
  );

  const status: BroadcastStatus = result.skipped
    ? "skipped"
    : result.sent === 0
      ? "failed"
      : result.failed > 0
        ? "partial"
        : "sent";

  const db = createAdminClient();
  await db.from("broadcasts").insert({
    sent_by: admin.id,
    channel: "email",
    audience,
    subject: parsed.data.subject,
    body: parsed.data.body,
    recipient_count: recipients.length,
    sent_count: result.sent,
    failed_count: result.failed,
    status,
  });

  revalidatePath("/admin/broadcast");

  if (result.skipped) {
    return {
      success: true,
      message: `Email is not configured (RESEND_API_KEY is unset). The message for ${recipients.length} recipient(s) was logged on the server, not delivered.`,
    };
  }
  if (status === "failed") {
    return {
      error: `The email could not be delivered to anyone. First error: ${result.errors[0] ?? "unknown"}`,
    };
  }
  if (status === "partial") {
    return {
      success: true,
      message: `Sent to ${result.sent} of ${recipients.length}. ${result.failed} address(es) failed — check the server log.`,
    };
  }
  return { success: true, message: `Sent to ${result.sent} people.` };
}

// ---------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------

/** Personalised text per recipient. No subject — an SMS is body only. */
function buildSmsMessages(
  recipients: BroadcastRecipient[],
  body: string,
): SmsMessage[] {
  return recipients.map((person) => ({
    to: person.phone,
    text: personalize(body, person),
  }));
}

function parseSmsForm(formData: FormData) {
  return smsBroadcastSchema.safeParse({
    audience: formData.get("audience"),
    body: formData.get("body"),
  });
}

/** Text the composed message to the signed-in admin only. Not recorded. */
export async function sendTestSmsAction(
  _prev: BroadcastActionState,
  formData: FormData,
): Promise<BroadcastActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };

  const parsed = parseSmsForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the message." };
  }
  if (!toE164(admin.phone)) {
    return {
      error:
        "Your own phone number is not a number we can text. Update it under Settings first.",
    };
  }

  const limit = rateLimit(`sms:test:${admin.id}`, 10, 60_000);
  if (!limit.ok) {
    return { error: "Too many test messages. Please wait a minute." };
  }

  const me: BroadcastRecipient = {
    id: admin.id,
    name: admin.full_name,
    email: admin.email,
    phone: admin.phone,
    role: admin.role,
    status: null,
    emailOptOut: false,
    smsOptOut: false,
  };
  const result = await sendBulkSms(buildSmsMessages([me], parsed.data.body));

  if (result.skipped) {
    return {
      success: true,
      message:
        "No SMS gateway is configured (SMS_API_KEY is unset), so the test was written to the server log instead of being sent.",
    };
  }
  if (result.failed > 0) {
    return { error: result.errors[0] ?? "The test message could not be sent." };
  }
  return { success: true, message: `Test text sent to ${admin.phone}.` };
}

/**
 * Text every registered user in the chosen audience. Anyone who opted out of
 * SMS, or whose number cannot be dialled, is excluded. Recorded in
 * `broadcasts` with channel `sms`.
 */
export async function sendSmsBroadcastAction(
  _prev: BroadcastActionState,
  formData: FormData,
): Promise<BroadcastActionState> {
  const admin = await ensureAdmin();
  if (!admin) return { error: "Not authorized." };

  const parsed = parseSmsForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the message." };
  }

  const limit = rateLimit(`sms:send:${admin.id}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return {
      error:
        "You have sent several texts in a row. Please wait a few minutes before sending another.",
    };
  }

  const audience = parsed.data.audience as BroadcastAudience;
  const recipients = selectRecipients(
    await getBroadcastRecipients(),
    audience,
    "sms",
  );
  if (recipients.length === 0) {
    return {
      error:
        "Nobody in that audience has a phone number we can text right now.",
    };
  }

  const result = await sendBulkSms(
    buildSmsMessages(recipients, parsed.data.body),
  );

  const status: BroadcastStatus = result.skipped
    ? "skipped"
    : result.sent === 0
      ? "failed"
      : result.failed > 0
        ? "partial"
        : "sent";

  const db = createAdminClient();
  await db.from("broadcasts").insert({
    sent_by: admin.id,
    channel: "sms",
    audience,
    subject: null,
    body: parsed.data.body,
    recipient_count: recipients.length,
    sent_count: result.sent,
    failed_count: result.failed,
    status,
  });

  revalidatePath("/admin/broadcast");

  if (result.skipped) {
    return {
      success: true,
      message: `No SMS gateway is configured (SMS_API_KEY is unset). The text for ${recipients.length} number(s) was logged on the server, not sent.`,
    };
  }
  if (status === "failed") {
    return {
      error: `The text could not be delivered to anyone. First error: ${result.errors[0] ?? "unknown"}`,
    };
  }
  if (status === "partial") {
    return {
      success: true,
      message: `Sent to ${result.sent} of ${recipients.length}. ${result.failed} number(s) failed — check the server log.`,
    };
  }
  return { success: true, message: `Text sent to ${result.sent} people.` };
}
