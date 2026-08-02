import { formatNaira } from "@/lib/format";

/**
 * Friendly templated reminder messages for the admin contact panel (spec 8).
 * Pure so they can be built and copied client-side.
 */
export interface ReminderContext {
  name: string;
  behindBy: number;
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
}

export function reminderMessage(ctx: ReminderContext): string {
  return [
    `Hello ${ctx.name},`,
    ``,
    `A gentle reminder about your Project Emerge partnership. You are currently ${formatNaira(ctx.behindBy)} behind your plan. There is no pressure — give at your pace, every bit moves the building forward.`,
    ``,
    `When you are ready, transfer to:`,
    `${ctx.bankAccountName}`,
    `${ctx.bankAccountNumber} — ${ctx.bankName}`,
    ``,
    `Then upload your receipt in the app and we will verify it. Thank you for building with us.`,
  ].join("\n");
}

export function whatsappMessage(ctx: ReminderContext): string {
  return [
    `Hello ${ctx.name}, a gentle reminder about your Project Emerge partnership.`,
    `You are currently ${formatNaira(ctx.behindBy)} behind your plan — no pressure, give at your pace.`,
    `Account: ${ctx.bankAccountName}, ${ctx.bankAccountNumber} (${ctx.bankName}).`,
    `Transfer then upload your receipt in the app. Thank you for building with us.`,
  ].join(" ");
}
