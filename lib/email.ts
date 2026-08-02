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

function shell(title: string, body: string): string {
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
