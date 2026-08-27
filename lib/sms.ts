import "server-only";
import { toE164 } from "@/lib/phone";

/**
 * Bulk SMS. Mirrors `lib/email.ts`: provider-agnostic, and degrades
 * gracefully — with no gateway configured the intended messages are logged
 * and the caller is told plainly that nothing was delivered.
 *
 * Two Nigerian gateways are supported out of the box, chosen with
 * `SMS_PROVIDER`. Both take an alphanumeric sender ID (e.g. `ProjEmerge`)
 * that must be registered with them first — see the README.
 */

export type SmsProvider = "termii" | "africastalking";

export interface SmsMessage {
  /** Any typed form; normalised to E.164 before sending. */
  to: string;
  text: string;
}

export interface SmsSendResult {
  attempted: number;
  sent: number;
  failed: number;
  /** True when no gateway is configured: nothing was delivered, only logged. */
  skipped: boolean;
  errors: string[];
}

export interface SmsConfig {
  provider: SmsProvider;
  apiKey: string;
  senderId: string;
  /** Africa's Talking only. */
  username: string;
}

/** Alphanumeric sender IDs are capped at 11 characters by the GSM standard. */
export const MAX_SENDER_ID_LENGTH = 11;

/** Resolved gateway settings, or null when SMS is not configured. */
export function smsConfig(): SmsConfig | null {
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) return null;

  const provider = (process.env.SMS_PROVIDER ?? "termii") as SmsProvider;
  if (provider !== "termii" && provider !== "africastalking") {
    console.error(`[sms:config] unknown SMS_PROVIDER "${provider}"`);
    return null;
  }

  return {
    provider,
    apiKey,
    senderId: process.env.SMS_SENDER_ID ?? "ProjEmerge",
    username: process.env.SMS_USERNAME ?? "sandbox",
  };
}

export function isSmsConfigured(): boolean {
  return smsConfig() !== null;
}

/** One Termii message. Their API takes a single recipient per call. */
async function sendViaTermii(
  config: SmsConfig,
  to: string,
  text: string,
): Promise<void> {
  const response = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: to.replace(/^\+/, ""), // Termii wants digits only
      from: config.senderId,
      sms: text,
      type: "plain",
      channel: "generic",
      api_key: config.apiKey,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Termii responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }
}

/**
 * Africa's Talking takes a comma-separated recipient list, so a batch of
 * identical messages goes in one call.
 */
async function sendViaAfricasTalking(
  config: SmsConfig,
  recipients: string[],
  text: string,
): Promise<void> {
  const body = new URLSearchParams({
    username: config.username,
    to: recipients.join(","),
    message: text,
    from: config.senderId,
  });
  const response = await fetch(
    "https://api.africastalking.com/version1/messaging",
    {
      method: "POST",
      headers: {
        apiKey: config.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Africa's Talking responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }
}

/**
 * Send one SMS per recipient. Personalised messages differ per person, so
 * each is sent individually; a failure is recorded against that number alone
 * and the rest still go out. Never throws.
 */
export async function sendBulkSms(
  messages: SmsMessage[],
  options: { pauseMs?: number } = {},
): Promise<SmsSendResult> {
  const result: SmsSendResult = {
    attempted: messages.length,
    sent: 0,
    failed: 0,
    skipped: false,
    errors: [],
  };
  if (messages.length === 0) return result;

  const config = smsConfig();
  if (!config) {
    console.info(
      `[sms:skipped] SMS_API_KEY not set. Would send "${messages[0].text.slice(0, 60)}…" to ${messages.length} number(s).`,
    );
    result.skipped = true;
    return result;
  }

  const pauseMs = options.pauseMs ?? 120; // be gentle with the gateway

  for (const [index, message] of messages.entries()) {
    const to = toE164(message.to);
    if (!to) {
      result.failed += 1;
      result.errors.push(`${message.to}: not a dialable number`);
      continue;
    }
    if (index > 0 && pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    try {
      if (config.provider === "africastalking") {
        await sendViaAfricasTalking(config, [to], message.text);
      } else {
        await sendViaTermii(config, to, message.text);
      }
      result.sent += 1;
    } catch (err) {
      result.failed += 1;
      result.errors.push(
        `${to}: ${err instanceof Error ? err.message : "send failed"}`,
      );
    }
  }

  return result;
}
