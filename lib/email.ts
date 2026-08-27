import "server-only";
import { formatNaira, formatDate } from "@/lib/format";
import { PLAN_LABELS, type Plan } from "@/lib/constants";

/**
 * Transactional email (section 9). Degrades gracefully: with no RESEND_API_KEY,
 * the intended email is logged and the call resolves successfully — no flow
 * ever throws because email is unconfigured.
 */

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

async function send({ to, subject, html }: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ??
    "Project Emerge <no-reply@ideallifecity.org>";

  if (!apiKey) {
    console.info(
      `[email:skipped] RESEND_API_KEY not set. Would send "${subject}" to ${to}`,
    );
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({ from, to, subject, html });
  } catch (err) {
    // Never let email break the request.
    console.error("[email:error]", err);
  }
}

const RED = "#C81E1E";
const GREEN = "#128A3A";
const INK = "#0B0B0B";
const PAPER = "#FBFAF6";

function shell(title: string, body: string, footerNote?: string): string {
  return `
  <div style="background:${PAPER};padding:24px;font-family:Inter,Arial,sans-serif;color:${INK};">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E7E4DB;border-radius:12px;overflow:hidden;">
      <div style="background:${RED};color:#fff;padding:20px 24px;">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">Ideal Life City</div>
        <div style="font-size:22px;font-weight:800;">Project Emerge</div>
      </div>
      <div style="padding:24px;line-height:1.55;font-size:15px;">
        <h1 style="font-size:18px;margin:0 0 12px;">${title}</h1>
        ${body}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #E7E4DB;font-size:12px;color:#666;">
        Building Together. Rising Visibly. &middot; Project Emerge, Phase One
        ${footerNote ? `<div style="margin-top:8px;">${footerNote}</div>` : ""}
      </div>
    </div>
  </div>`;
}

interface BankDetails {
  accountName: string;
  accountNumber: string;
  bankName: string;
}

function bankBlock(bank: BankDetails): string {
  return `
    <div style="background:${PAPER};border:1px solid #E7E4DB;border-radius:8px;padding:14px;margin:14px 0;">
      <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;">Church account</div>
      <div><strong>${bank.accountName}</strong></div>
      <div style="font-family:'Space Grotesk',monospace;font-size:18px;">${bank.accountNumber}</div>
      <div>${bank.bankName}</div>
    </div>`;
}

export interface WelcomeEmailData {
  to: string;
  name: string;
  amount: number;
  plan: Plan;
  schedule: Array<{ sequence: number; dueDate: string; amount: number }>;
  bank: BankDetails;
}

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  const rows = data.schedule
    .map(
      (s) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.sequence}</td>
         <td style="padding:6px 10px;border-bottom:1px solid #eee;">${formatDate(s.dueDate)}</td>
         <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-family:'Space Grotesk',monospace;">${formatNaira(s.amount)}</td></tr>`,
    )
    .join("");
  const body = `
    <p>Welcome, ${data.name}. Thank you for partnering with Project Emerge.</p>
    <p>You are partnering with <strong>${formatNaira(data.amount)}</strong> on the <strong>${PLAN_LABELS[data.plan]}</strong>.</p>
    ${bankBlock(data.bank)}
    <p>Transfer to this account, then upload your receipt in the app. Every approved receipt moves your progress forward.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">
      <thead><tr>
        <th style="text-align:left;padding:6px 10px;color:#666;">#</th>
        <th style="text-align:left;padding:6px 10px;color:#666;">Due</th>
        <th style="text-align:right;padding:6px 10px;color:#666;">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  await send({
    to: data.to,
    subject: "Welcome to Project Emerge",
    html: shell("You are building with us", body),
  });
}

export async function sendReceiptReceivedEmail(data: {
  to: string;
  name: string;
  amount: number;
}): Promise<void> {
  const body = `
    <p>Hello ${data.name},</p>
    <p>We received your receipt for <strong>${formatNaira(data.amount)}</strong>. It is now pending review. We will let you know as soon as an admin verifies it.</p>`;
  await send({
    to: data.to,
    subject: "We received your receipt",
    html: shell("Receipt received", body),
  });
}

export async function sendReceiptApprovedEmail(data: {
  to: string;
  name: string;
  amount: number;
  verifiedTotal: number;
  remaining: number;
}): Promise<void> {
  const body = `
    <p>Hello ${data.name},</p>
    <p>Your receipt for <strong>${formatNaira(data.amount)}</strong> has been approved.</p>
    <p style="color:${GREEN};"><strong>Verified so far: ${formatNaira(data.verifiedTotal)}</strong><br/>
    Remaining: ${formatNaira(data.remaining)}</p>
    <p>Thank you for building with us.</p>`;
  await send({
    to: data.to,
    subject: "Your receipt was approved",
    html: shell("Receipt approved", body),
  });
}

export async function sendReceiptRejectedEmail(data: {
  to: string;
  name: string;
  amount: number;
  reason: string;
  siteUrl: string;
}): Promise<void> {
  const body = `
    <p>Hello ${data.name},</p>
    <p>We were not able to verify your receipt for <strong>${formatNaira(data.amount)}</strong>.</p>
    <p><strong>Reason:</strong> ${data.reason}</p>
    <p>Please re-upload a clear receipt from your dashboard: <a href="${data.siteUrl}/dashboard" style="color:${RED};">Open my dashboard</a>.</p>`;
  await send({
    to: data.to,
    subject: "Please re-upload your receipt",
    html: shell("Receipt needs another look", body),
  });
}

export async function sendBehindReminderEmail(data: {
  to: string;
  name: string;
  behindBy: number;
  bank: BankDetails;
}): Promise<void> {
  const body = `
    <p>Hello ${data.name},</p>
    <p>A gentle reminder about your Project Emerge partnership. You are currently <strong>${formatNaira(data.behindBy)}</strong> behind your plan. Give at your pace — every bit moves the building forward.</p>
    ${bankBlock(data.bank)}
    <p>Transfer to this account, then upload your receipt in the app.</p>`;
  await send({
    to: data.to,
    subject: "A gentle reminder from Project Emerge",
    html: shell("We are building together", body),
  });
}

// ---------------------------------------------------------------------------
// Broadcast (announcement to many registered users)
// ---------------------------------------------------------------------------

export interface BroadcastEmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface BroadcastSendResult {
  attempted: number;
  sent: number;
  failed: number;
  /** True when RESEND_API_KEY is unset: nothing was delivered, only logged. */
  skipped: boolean;
  errors: string[];
}

/**
 * Wrap a broadcast body in the campaign shell. The footer tells partners how
 * to stop receiving announcements — transactional mail is unaffected.
 */
export function renderBroadcastEmail(args: {
  title: string;
  bodyHtml: string;
  siteUrl: string;
}): string {
  const footer = `You are receiving this because you are registered on Project Emerge. To stop receiving announcements, open <a href="${args.siteUrl}/dashboard/settings" style="color:#666;">your settings</a>.`;
  return shell(args.title, args.bodyHtml, footer);
}

/**
 * Send one message per recipient, in batches. Resend's batch endpoint takes
 * up to 100 messages per call; if a batch is rejected we retry its messages
 * individually so one bad address cannot silence the other ninety-nine.
 *
 * Never throws: the caller reports counts back to the admin.
 */
export async function sendBroadcastEmails(
  messages: BroadcastEmailMessage[],
  options: { batchSize?: number; pauseMs?: number } = {},
): Promise<BroadcastSendResult> {
  const result: BroadcastSendResult = {
    attempted: messages.length,
    sent: 0,
    failed: 0,
    skipped: false,
    errors: [],
  };
  if (messages.length === 0) return result;

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ??
    "Project Emerge <no-reply@ideallifecity.org>";

  if (!apiKey) {
    console.info(
      `[email:skipped] RESEND_API_KEY not set. Would send "${messages[0].subject}" to ${messages.length} recipient(s).`,
    );
    result.skipped = true;
    return result;
  }

  const batchSize = options.batchSize ?? 100;
  const pauseMs = options.pauseMs ?? 600; // stay under Resend's rate limit

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const batches: BroadcastEmailMessage[][] = [];
  for (let i = 0; i < messages.length; i += batchSize) {
    batches.push(messages.slice(i, i + batchSize));
  }

  for (const [index, batch] of batches.entries()) {
    if (index > 0 && pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    const payload = batch.map((m) => ({
      from,
      to: m.to,
      subject: m.subject,
      html: m.html,
    }));

    let batchOk = false;
    try {
      const { error } = await resend.batch.send(payload);
      batchOk = !error;
      if (error) {
        console.error("[email:broadcast:batch]", error);
      }
    } catch (err) {
      console.error("[email:broadcast:batch]", err);
    }

    if (batchOk) {
      result.sent += batch.length;
      continue;
    }

    // Fall back to one-by-one so a single rejected address is isolated.
    for (const message of batch) {
      try {
        const { error } = await resend.emails.send({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
        });
        if (error) {
          result.failed += 1;
          result.errors.push(`${message.to}: ${error.message}`);
        } else {
          result.sent += 1;
        }
      } catch (err) {
        result.failed += 1;
        result.errors.push(
          `${message.to}: ${err instanceof Error ? err.message : "send failed"}`,
        );
      }
    }
  }

  return result;
}
